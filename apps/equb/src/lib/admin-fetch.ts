/** Client helper: attach admin identity header for protected APIs */

import { useEqubStore } from '@/lib/store';

export function adminHeaders(extra?: HeadersInit): HeadersInit {
  const id = useEqubStore.getState().user?.id || '';
  return {
    'Content-Type': 'application/json',
    ...(id ? { 'x-user-id': id } : {}),
    ...extra,
  };
}

export async function adminFetch(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const id = useEqubStore.getState().user?.id || '';
  if (id && !headers.has('x-user-id')) headers.set('x-user-id', id);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers, cache: 'no-store' });
}
