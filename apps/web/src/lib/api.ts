/**
 * Resolve the API base URL for browser + server components.
 *
 * Priority:
 * 1. NEXT_PUBLIC_API_URL (explicit)
 * 2. On localhost / 127.0.0.1 → http://localhost:3001 (local dev default)
 * 3. Empty → offline / pure demo mode
 */
function resolveRawApi(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  // Local development convenience: talk to the Nest API without requiring .env
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3001';
    }
  } else if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3001';
  }

  return '';
}

const RAW_API = resolveRawApi();

/** Resolved API base. Empty = force offline/demo mode. */
export function getApiBase(): string {
  if (!RAW_API) return '';
  if (typeof window !== 'undefined') {
    try {
      const apiHost = new URL(RAW_API).hostname;
      // Same hostname usually means a reverse-proxy / same-origin setup.
      // In that case prefer relative paths so cookies and CORS stay simple.
      // We still return the full base for now because the API lives on a
      // different port locally and a different host in production.
      if (apiHost === window.location.hostname && apiHost !== 'localhost' && apiHost !== '127.0.0.1') {
        // Production same-origin: use relative so requests go through the proxy
        return '';
      }
    } catch {
      return '';
    }
  }
  return RAW_API;
}

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, opts?: { code?: string; status?: number }) {
    super(message);
    this.name = 'ApiError';
    this.code = opts?.code;
    this.status = opts?.status;
  }
}

export function isApiConfigured(): boolean {
  const base = getApiBase();
  // When base is empty we may still be same-origin (relative /api). Treat as configured
  // only if we intentionally decided same-origin above, otherwise offline.
  if (!base && !RAW_API) return false;
  if (!base && RAW_API) {
    // Same-origin production case
    return true;
  }
  if (typeof window === 'undefined') return true;
  try {
    const u = new URL(base || RAW_API);
    if (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      // Deployed frontend must not call a localhost API
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  if (!isApiConfigured()) {
    throw new ApiError('API not available in this environment', {
      code: 'API_OFFLINE',
      status: 0,
    });
  }

  const base = getApiBase();
  const { token, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // When base is empty we are same-origin → use relative /api
  const url = base ? `${base}/api${path}` : `/api${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Network error — API unreachable', {
      code: 'NETWORK',
      status: 0,
    });
  }

  let json: any = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(res.ok ? 'Invalid response' : `Request failed (${res.status})`, {
      code: 'HTTP_ERROR',
      status: res.status,
    });
  }

  if (!res.ok || json?.success === false) {
    throw new ApiError(json?.error?.message || json?.message || `Request failed (${res.status})`, {
      code: json?.error?.code || 'HTTP_ERROR',
      status: res.status,
    });
  }

  return (json?.data !== undefined ? json.data : json) as T;
}

export const API_URL = RAW_API || 'http://localhost:3001';
