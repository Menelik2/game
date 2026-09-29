const RAW_API = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/$/, '');

/** Resolved API base. Empty = force offline/demo mode. */
export function getApiBase(): string {
  if (!RAW_API) return '';
  if (typeof window !== 'undefined') {
    try {
      const apiHost = new URL(RAW_API).hostname;
      if (apiHost === window.location.hostname) return '';
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
  if (!base) return false;
  if (typeof window === 'undefined') return true;
  try {
    const u = new URL(base);
    if (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
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

  let res: Response;
  try {
    res = await fetch(`${base}/api${path}`, {
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
