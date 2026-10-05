/** Database-only auth + wallet. No localStorage accounts. */

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
}): Promise<{ ok: true; user: ApiUser } | { ok: false; error: string }> {
  try {
    const { res, json } = await post('/api/auth/register', input);
    if (json?.code === 'DB_NOT_CONFIGURED') {
      return {
        ok: false,
        error:
          'Database not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run migration 20261005_app_users.sql.',
      };
    }
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.message || 'Register failed' };
    }
    return { ok: true, user: json.data as ApiUser };
  } catch {
    return { ok: false, error: 'Cannot reach database API' };
  }
}

export async function apiLogin(input: {
  phone: string;
  password: string;
}): Promise<{ ok: true; user: ApiUser } | { ok: false; error: string }> {
  try {
    const { res, json } = await post('/api/auth/login', input);
    if (json?.code === 'DB_NOT_CONFIGURED') {
      return {
        ok: false,
        error: 'Database not configured. Set Supabase env vars on Vercel.',
      };
    }
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.message || 'Invalid phone or password' };
    }
    return { ok: true, user: json.data as ApiUser };
  } catch {
    return { ok: false, error: 'Cannot reach database API' };
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
    if (!res.ok || !json?.success) return null;
    return (json.data?.items || []) as ApiUser[];
  } catch {
    return null;
  }
}

export async function apiSetBalance(
  userId: string,
  balance: number,
  reason = 'admin_set',
): Promise<{ ok: true; user: ApiUser } | { ok: false; error: string }> {
  try {
    const { res, json } = await post(
      `/api/users/${encodeURIComponent(userId)}/balance`,
      { balance, reason },
    );
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.message || 'Set balance failed' };
    }
    return { ok: true, user: json.data as ApiUser };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export async function apiAdjustBalance(
  userId: string,
  delta: number,
  reason = 'adjust',
): Promise<{ ok: true; user: ApiUser } | { ok: false; error: string }> {
  try {
    const { res, json } = await post(
      `/api/users/${encodeURIComponent(userId)}/balance`,
      { delta, reason },
    );
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.message || 'Adjust failed' };
    }
    return { ok: true, user: json.data as ApiUser };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export function isDbUserId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}
