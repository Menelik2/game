const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...init } = options;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    const err = new Error(json?.error?.message || 'Request failed') as Error & {
      code?: string;
      status?: number;
    };
    err.code = json?.error?.code;
    err.status = res.status;
    throw err;
  }
  return (json.data !== undefined ? json.data : json) as T;
}
