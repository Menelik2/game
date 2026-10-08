/**
 * Unified API client — always same-origin /api on abelgame.
 * Optional NEXT_PUBLIC_API_URL is only for /backend/* proxies (Verify.ET helper).
 * Auth, wallet, rooms, admin MUST use this client (credentials: include).
 */

export function apiBase(): string {
  // Same-origin: cookies + sessions work. Do not point auth at game-rho.
  return '';
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase()}${p}`;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
}

export async function apiJson<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await apiFetch(path, init);
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}
