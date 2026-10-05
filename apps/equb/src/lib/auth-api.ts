/**
 * Database-only auth (Supabase app_users). No localStorage accounts.
 */

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
          'Database not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then run migration 20261005_app_users.sql in Supabase.',
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
        error:
          'Database not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel.',
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
