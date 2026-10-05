import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

export function isDbConfigured(): boolean {
  return Boolean(url && key && url.startsWith('http'));
}

let client: SupabaseClient | null = null;

function sb(): SupabaseClient {
  if (!isDbConfigured()) throw new Error('Database not configured');
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export type DbUser = {
  id: string;
  fullName: string;
  phone: string;
  balance: number;
  referralCode: string;
  role: string;
  banned?: boolean;
};

function mapUser(raw: any): DbUser {
  return {
    id: String(raw.id),
    fullName: String(raw.fullName ?? raw.full_name ?? ''),
    phone: String(raw.phone ?? ''),
    balance: Number(raw.balance ?? 0),
    referralCode: String(raw.referralCode ?? raw.referral_code ?? ''),
    role: String(raw.role ?? 'player'),
    banned: Boolean(raw.banned),
  };
}

export async function dbRegister(input: {
  fullName: string;
  phone: string;
  passwordHash: string;
}): Promise<{ ok: true; user: DbUser } | { ok: false; error: string }> {
  try {
    const { data, error } = await sb().rpc('app_register', {
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_password_hash: input.passwordHash,
    });
    if (error) {
      const m = error.message || '';
      if (m.includes('PHONE_EXISTS')) return { ok: false, error: 'Phone already registered' };
      return { ok: false, error: m || 'Register failed' };
    }
    return { ok: true, user: mapUser(data) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Database error' };
  }
}

export async function dbLogin(input: {
  phone: string;
  passwordHash: string;
}): Promise<{ ok: true; user: DbUser } | { ok: false; error: string }> {
  try {
    const { data, error } = await sb().rpc('app_login', {
      p_phone: input.phone,
      p_password_hash: input.passwordHash,
    });
    if (error) {
      const m = error.message || '';
      if (m.includes('BANNED')) return { ok: false, error: 'Account banned' };
      return { ok: false, error: 'Invalid phone or password' };
    }
    return { ok: true, user: mapUser(data) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Database error' };
  }
}

export async function dbGetUser(id: string): Promise<DbUser | null> {
  try {
    const { data, error } = await sb().rpc('app_get_user', { p_id: id });
    if (error || !data) return null;
    return mapUser(data);
  } catch {
    return null;
  }
}

export async function dbListUsers(): Promise<DbUser[]> {
  const { data, error } = await sb().rpc('app_list_users');
  if (error) throw new Error(error.message);
  return (Array.isArray(data) ? data : []).map(mapUser);
}

export async function dbEnsureAdmin(phone: string, passwordHash: string) {
  await sb().rpc('app_ensure_admin', {
    p_phone: phone,
    p_password_hash: passwordHash,
    p_full_name: 'Admin',
  });
}

export async function dbSetBalance(id: string, balance: number, reason = 'admin_adjust') {
  const { data, error } = await sb().rpc('app_set_balance', {
    p_id: id,
    p_balance: balance,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function dbAdjustBalance(id: string, delta: number, reason = 'adjust') {
  const { data, error } = await sb().rpc('app_adjust_balance', {
    p_id: id,
    p_delta: delta,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; balance: number };
}
