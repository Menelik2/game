/** Client helper: send cookies (session) — never forge x-user-id for auth */

export async function adminFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
}
