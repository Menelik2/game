export type ApiUser = {
  id: string;
  fullName: string;
  phone: string;
  balance: number;
  referralCode: string;
  role: string;
  banned?: boolean;
};

async function post(path: string, body: object) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

export async function apiRegister(input: {
  fullName: string;
  phone: string;
  password: string;
}): Promise<
  | { ok: true; user: ApiUser; source: 'db' }
  | { ok: false; error: string; fallbackLocal?: boolean }
> {
  try {
    const { res, json } = await post('/api/auth/register', input);
    if (json?.code === 'DB_NOT_CONFIGURED') {
      return { ok: false, error: json.message || 'DB not configured', fallbackLocal: true };
    }
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.message || 'Register failed' };
    }
    return { ok: true, user: json.data as ApiUser, source: 'db' };
  } catch {
    return { ok: false, error: 'Network error', fallbackLocal: true };
  }
}

export async function apiLogin(input: {
  phone: string;
  password: string;
}): Promise<
  | { ok: true; user: ApiUser; source: 'db' }
  | { ok: false; error: string; fallbackLocal?: boolean }
> {
  try {
    const { res, json } = await post('/api/auth/login', input);
    if (json?.code === 'DB_NOT_CONFIGURED') {
      return { ok: false, error: json.message || 'DB not configured', fallbackLocal: true };
    }
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.message || 'Login failed' };
    }
    return { ok: true, user: json.data as ApiUser, source: 'db' };
  } catch {
    return { ok: false, error: 'Network error', fallbackLocal: true };
  }
}

export async function apiRefreshUser(id: string): Promise<ApiUser | null> {
  try {
    const res = await fetch(`/api/auth/me?id=${encodeURIComponent(id)}`);
    const json = await res.json();
    if (!res.ok || !json?.success) return null;
    return json.data as ApiUser;
  } catch {
    return null;
  }
}

export async function apiListUsers(): Promise<ApiUser[] | null> {
  try {
    const res = await fetch('/api/users');
    const json = await res.json();
    if (json?.code === 'DB_NOT_CONFIGURED') return null;
    if (!res.ok || !json?.success) return null;
    return (json.data?.items || []) as ApiUser[];
  } catch {
    return null;
  }
}
