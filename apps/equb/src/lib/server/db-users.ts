import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

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

type MemUser = DbUser & { passwordHash: string };

const g = globalThis as unknown as { __appUsers?: Map<string, MemUser> };
if (!g.__appUsers) g.__appUsers = new Map();
const mem = g.__appUsers;

function memByPhone(phone: string): MemUser | undefined {
  for (const u of mem.values()) {
    if (u.phone === phone) return u;
  }
  return undefined;
}

function mapUser(raw: any): DbUser {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid user payload from database');
  }
  const r = Array.isArray(raw) ? raw[0] : raw;
  return {
    id: String(r.id),
    fullName: String(r.fullName ?? r.full_name ?? ''),
    phone: String(r.phone ?? ''),
    balance: Number(r.balance ?? 0),
    referralCode: String(r.referralCode ?? r.referral_code ?? ''),
    role: String(r.role ?? 'player'),
    banned: Boolean(r.banned),
  };
}

function publicUser(u: MemUser): DbUser {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

function referralCode(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

function memRegister(input: {
  fullName: string;
  phone: string;
  passwordHash: string;
}): { ok: true; user: DbUser } | { ok: false; error: string } {
  if (memByPhone(input.phone)) {
    return { ok: false, error: 'Phone already registered' };
  }
  const id = randomUUID();
  const u: MemUser = {
    id,
    fullName: input.fullName,
    phone: input.phone,
    passwordHash: input.passwordHash,
    balance: 100,
    referralCode: referralCode(),
    role: 'player',
    banned: false,
  };
  mem.set(id, u);
  return { ok: true, user: publicUser(u) };
}

function memLogin(input: {
  phone: string;
  passwordHash: string;
}): { ok: true; user: DbUser } | { ok: false; error: string } {
  const u = memByPhone(input.phone);
  if (!u || u.passwordHash !== input.passwordHash) {
    return { ok: false, error: 'Invalid phone or password' };
  }
  if (u.banned) return { ok: false, error: 'Account banned' };
  return { ok: true, user: publicUser(u) };
}

async function registerViaTable(input: {
  fullName: string;
  phone: string;
  passwordHash: string;
}): Promise<{ ok: true; user: DbUser } | { ok: false; error: string }> {
  const code = referralCode();
  const { data, error } = await sb()
    .from('app_users')
    .insert({
      full_name: input.fullName,
      phone: input.phone,
      password_hash: input.passwordHash,
      balance: 100,
      referral_code: code,
      role: 'player',
    })
    .select('id, full_name, phone, balance, referral_code, role, banned')
    .single();

  if (error) {
    const m = error.message || '';
    if (m.toLowerCase().includes('duplicate') || m.includes('unique')) {
      return { ok: false, error: 'Phone already registered' };
    }
    return { ok: false, error: m || 'Register failed' };
  }
  return { ok: true, user: mapUser(data) };
}

async function loginViaTable(input: {
  phone: string;
  passwordHash: string;
}): Promise<{ ok: true; user: DbUser } | { ok: false; error: string }> {
  const { data, error } = await sb()
    .from('app_users')
    .select(
      'id, full_name, phone, balance, referral_code, role, banned, password_hash',
    )
    .eq('phone', input.phone)
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: 'Invalid phone or password' };
  }
  if (data.banned) return { ok: false, error: 'Account banned' };
  if (String(data.password_hash) !== input.passwordHash) {
    return { ok: false, error: 'Invalid phone or password' };
  }
  return { ok: true, user: mapUser(data) };
}

export async function dbRegister(input: {
  fullName: string;
  phone: string;
  passwordHash: string;
}): Promise<{ ok: true; user: DbUser } | { ok: false; error: string }> {
  if (!isDbConfigured()) {
    return memRegister(input);
  }

  try {
    const { data, error } = await sb().rpc('app_register', {
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_password_hash: input.passwordHash,
    });
    if (!error && data) {
      try {
        return { ok: true, user: mapUser(data) };
      } catch {
        /* fall through */
      }
    }
    if (error) {
      const m = (error.message || '').toLowerCase();
      if (m.includes('phone_exists') || m.includes('already')) {
        return { ok: false, error: 'Phone already registered' };
      }
      if (
        m.includes('function') ||
        m.includes('does not exist') ||
        m.includes('schema cache') ||
        m.includes('could not find')
      ) {
        const viaTable = await registerViaTable(input);
        if (viaTable.ok) return viaTable;
        return memRegister(input);
      }
      const viaTable = await registerViaTable(input);
      if (viaTable.ok) return viaTable;
      return { ok: false, error: error.message || 'Register failed' };
    }
  } catch {
    const viaTable = await registerViaTable(input).catch(() => null);
    if (viaTable?.ok) return viaTable;
    return memRegister(input);
  }

  return memRegister(input);
}

export async function dbLogin(input: {
  phone: string;
  passwordHash: string;
}): Promise<{ ok: true; user: DbUser } | { ok: false; error: string }> {
  if (!isDbConfigured()) {
    return memLogin(input);
  }

  try {
    const { data, error } = await sb().rpc('app_login', {
      p_phone: input.phone,
      p_password_hash: input.passwordHash,
    });
    if (!error && data) {
      try {
        return { ok: true, user: mapUser(data) };
      } catch {
        /* fall through */
      }
    }
    if (error) {
      const m = (error.message || '').toLowerCase();
      if (m.includes('banned')) return { ok: false, error: 'Account banned' };
      if (
        m.includes('function') ||
        m.includes('does not exist') ||
        m.includes('schema cache')
      ) {
        const viaTable = await loginViaTable(input);
        if (viaTable.ok) return viaTable;
        return memLogin(input);
      }
    }
    const viaTable = await loginViaTable(input);
    if (viaTable.ok) return viaTable;
  } catch {
    /* fall through */
  }

  const local = memLogin(input);
  if (local.ok) return local;
  return { ok: false, error: 'Invalid phone or password' };
}

export async function dbGetUser(id: string): Promise<DbUser | null> {
  const local = mem.get(id);
  if (local) return publicUser(local);

  if (!isDbConfigured()) return null;
  try {
    const { data, error } = await sb().rpc('app_get_user', { p_id: id });
    if (!error && data) return mapUser(data);
  } catch {
    /* */
  }
  try {
    const { data } = await sb()
      .from('app_users')
      .select('id, full_name, phone, balance, referral_code, role, banned')
      .eq('id', id)
      .maybeSingle();
    if (data) return mapUser(data);
  } catch {
    /* */
  }
  return null;
}

export async function dbSetBalance(
  id: string,
  balance: number,
  _reason = 'admin_adjust',
) {
  const local = mem.get(id);
  if (local) {
    local.balance = Math.max(0, balance);
    mem.set(id, local);
    return publicUser(local);
  }
  if (!isDbConfigured()) throw new Error('User not found');
  const { data, error } = await sb().rpc('app_set_balance', {
    p_id: id,
    p_balance: balance,
    p_reason: _reason,
  });
  if (error) {
    const { error: e2 } = await sb()
      .from('app_users')
      .update({ balance, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (e2) throw new Error(e2.message);
    const u = await dbGetUser(id);
    if (!u) throw new Error('User not found');
    return u;
  }
  return mapUser(data);
}

export async function dbAdjustBalance(
  id: string,
  delta: number,
  _reason = 'adjust',
) {
  const local = mem.get(id);
  if (local) {
    const next = Math.round((local.balance + delta) * 100) / 100;
    if (next < 0) throw new Error('Insufficient balance');
    local.balance = next;
    mem.set(id, local);
    return { id, balance: next };
  }
  if (!isDbConfigured()) throw new Error('User not found');
  const { data, error } = await sb().rpc('app_adjust_balance', {
    p_id: id,
    p_delta: delta,
    p_reason: _reason,
  });
  if (error) {
    const u = await dbGetUser(id);
    if (!u) throw new Error('User not found');
    const next = Math.round((u.balance + delta) * 100) / 100;
    if (next < 0) throw new Error('Insufficient balance');
    await sb().from('app_users').update({ balance: next }).eq('id', id);
    return { id, balance: next };
  }
  return data as { id: string; balance: number };
}

export async function dbListUsers(): Promise<DbUser[]> {
  const fromMem = [...mem.values()].map(publicUser);
  if (!isDbConfigured()) return fromMem;
  try {
    const { data, error } = await sb().rpc('app_list_users');
    if (!error && data) {
      const arr = Array.isArray(data) ? data : [];
      return arr.map(mapUser);
    }
  } catch {
    /* */
  }
  try {
    const { data } = await sb()
      .from('app_users')
      .select('id, full_name, phone, balance, referral_code, role, banned')
      .order('created_at', { ascending: false });
    if (data?.length) return data.map(mapUser);
  } catch {
    /* */
  }
  return fromMem;
}

export async function dbEnsureAdmin(phone: string, passwordHash: string) {
  if (!isDbConfigured()) {
    if (![...mem.values()].some((u) => u.role === 'admin')) {
      const id = randomUUID();
      mem.set(id, {
        id,
        fullName: 'Admin',
        phone,
        passwordHash,
        balance: 1_000_000,
        referralCode: 'ADMIN001',
        role: 'admin',
        banned: false,
      });
    }
    return;
  }
  try {
    await sb().rpc('app_ensure_admin', {
      p_phone: phone,
      p_password_hash: passwordHash,
      p_full_name: 'Admin',
    });
  } catch {
    const existing = await sb()
      .from('app_users')
      .select('id')
      .eq('role', 'admin')
      .maybeSingle();
    if (!existing.data) {
      await sb().from('app_users').insert({
        full_name: 'Admin',
        phone,
        password_hash: passwordHash,
        balance: 1_000_000,
        referral_code: 'ADMIN001',
        role: 'admin',
      });
    }
  }
}
