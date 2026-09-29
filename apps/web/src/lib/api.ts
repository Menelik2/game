const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

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

/** True when browser cannot reach a real API (Vercel without backend, etc.) */
export function isApiConfigured(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const u = new URL(API_URL);
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

  const { token, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
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
      status: res.status,
    });
  }

  if (!res.ok || json?.success === false) {
    throw new ApiError(json?.error?.message || json?.message || 'Request failed', {
      code: json?.error?.code,
      status: res.status,
    });
  }

  return (json?.data !== undefined ? json.data : json) as T;
}

export { API_URL };
