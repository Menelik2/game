const KEY = 'equb_session_user_id';

export function saveSessionUserId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (!id) {
    sessionStorage.removeItem(KEY);
    return;
  }
  sessionStorage.setItem(KEY, id);
}

export function loadSessionUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(KEY);
}
