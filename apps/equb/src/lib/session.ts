/** Client UI cache + clear server httpOnly session on logout */

const ID_KEY = 'equb_session_user_id';
const USER_KEY = 'equb_session_user_v1';

export type SessionUser = {
  id: string;
  name: string;
  phone?: string;
  email: string;
  balance: number;
  referralCode: string;
  referredBy?: string;
  role?: 'player' | 'admin';
  banned?: boolean;
};

export function saveSessionUserId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (!id) {
    localStorage.removeItem(ID_KEY);
    sessionStorage.removeItem(ID_KEY);
    return;
  }
  localStorage.setItem(ID_KEY, id);
  try {
    sessionStorage.setItem(ID_KEY, id);
  } catch {
    /* ignore */
  }
}

export function loadSessionUserId(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem(ID_KEY) ||
    sessionStorage.getItem(ID_KEY) ||
    null
  );
}

export function saveSessionUser(user: SessionUser | null) {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(USER_KEY);
    saveSessionUserId(null);
    return;
  }
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  saveSessionUserId(user.id);
}

export function loadSessionUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as SessionUser;
    if (!u?.id) return null;
    return u;
  } catch {
    return null;
  }
}

export function clearSession() {
  saveSessionUser(null);
  // Clear httpOnly server cookie
  if (typeof window !== 'undefined') {
    void fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => undefined);
  }
}
