import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

/** True when Supabase URL + key are set (users persist in database) */
export function isDbConfigured(): boolean {
  return Boolean(url && key && url.startsWith('http'));
}

/** Prefer real DB in production; memory only for local/demo without env */
export function requireDb(): boolean {
  return (
    process.env.REQUIRE_DB === 'true' ||
    process.env.NODE_ENV === 'production'
  );
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
    throw new Error('Invalid user payload');
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
  return {
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    balance: u.balance,
    referralCode: u.referralCode,
    role: u.role,
    banned: u.banned,
  };
}

function referralCode(): string {
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  return norm(a) === norm(b);
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

function memResetPassword(input: {
  phone: string;
  fullName: string;
  passwordHash: string;
}): { ok: true; user: DbUser } | { ok: false; error: string } {
  const u = memByPhone(input.phone);
  if (!u) return { ok: false, error: 'No account found for this phone' };
  if (!namesMatch(u.fullName, input.fullName)) {
    return { ok: false, error: 'Full name does not match account' };
  }
  if (u.banned) return { ok: false, error: 'Account banned' };
  u.passwordHash = input.passwordHash;
  return { ok: true, user: publicUser(u) };
}

export async function dbRegister(input: {
  fullName: string;
  phone: string;
  passwordHash: string;
}): Promise<
  | { ok: true; user: DbUser; storage: 'database' | 'memory' }
  | { ok: false; error: string }
> {
  // Production: must use real database
  if (!isDbConfigured()) {
    if (requireDb()) {
      return {
        ok: false,
        error:
          'Database not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Vercel.',
      };
    }
    const r = memRegister(input);
    if (!r.ok) return r;
    return { ok: true, user: r.user, storage: 'memory' };
  }

  // 1) RPC
  try {
    const { data, error } = await sb().rpc('app_register', {
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_password_hash: input.passwordHash,
    });
    if (!error && data) {
      try {
        return { ok: true, user: mapUser(data), storage: 'database' };
      } catch {
        /* try insert */
      }
    }
    if (error?.message?.toLowerCase().includes('phone_exists')) {
      return { ok: false, error: 'Phone already registered' };
    }
  } catch (e) {
    console.error('[dbRegister] rpc', e);
  }

  // 2) Direct table insert
  try {
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
        banned: false,
      })
      .select('id, full_name, phone, balance, referral_code, role, banned')
      .single();

    if (!error && data) {
      return { ok: true, user: mapUser(data), storage: 'database' };
    }

    const msg = (error?.message || '').toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return { ok: false, error: 'Phone already registered' };
    }
    if (error) {
      console.error('[dbRegister] insert', error.message);
      if (requireDb()) {
        return {
          ok: false,
          error: `Database error: ${error.message}. Run supabase/schema.sql in Supabase.`,
        };
      }
    }
  } catch (e) {
    console.error('[dbRegister] insert exception', e);
    if (requireDb()) {
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : 'Database write failed. Check Supabase table app_users.',
      };
    }
  }

  // Dev fallback only
  if (!requireDb()) {
    const r = memRegister(input);
    if (!r.ok) return r;
    return { ok: true, user: r.user, storage: 'memory' };
  }

  return {
    ok: false,
    error:
      'Could not save user to database. Create table app_users (see apps/equb/supabase/schema.sql).',
  };
}

export async function dbLogin(input: {
  phone: string;
  passwordHash: string;
}): Promise<{ ok: true; user: DbUser } | { ok: false; error: string }> {
  try {
    if (isDbConfigured()) {
      try {
        const { data, error } = await sb().rpc('app_login', {
          p_phone: input.phone,
          p_password_hash: input.passwordHash,
        });
        if (!error && data) {
          try {
            return { ok: true, user: mapUser(data) };
          } catch {
            /* */
          }
        }
      } catch {
        /* */
      }

      try {
        const { data } = await sb()
          .from('app_users')
          .select(
            'id, full_name, phone, balance, referral_code, role, banned, password_hash',
          )
          .eq('phone', input.phone)
          .maybeSingle();
        if (data && String(data.password_hash) === input.passwordHash) {
          if (data.banned) return { ok: false, error: 'Account banned' };
          return { ok: true, user: mapUser(data) };
        }
        if (data && String(data.password_hash) !== input.passwordHash) {
          return { ok: false, error: 'Invalid phone or password' };
        }
      } catch {
        /* */
      }
    }

    return memLogin(input);
  } catch {
    return memLogin(input);
  }
}

export async function dbResetPassword(input: {
  phone: string;
  fullName: string;
  passwordHash: string;
}): Promise<{ ok: true; user: DbUser } | { ok: false; error: string }> {
  try {
    if (isDbConfigured()) {
      try {
        const { data } = await sb()
          .from('app_users')
          .select('id, full_name, phone, balance, referral_code, role, banned')
          .eq('phone', input.phone)
          .maybeSingle();

        if (data) {
          if (data.banned) return { ok: false, error: 'Account banned' };
          if (!namesMatch(String(data.full_name || ''), input.fullName)) {
            return { ok: false, error: 'Full name does not match account' };
          }
          const { error } = await sb()
            .from('app_users')
            .update({ password_hash: input.passwordHash })
            .eq('id', data.id);
          if (error) {
            return { ok: false, error: error.message || 'Update failed' };
          }
          return { ok: true, user: mapUser(data) };
        }
      } catch {
        /* fall through */
      }
    }

    return memResetPassword(input);
  } catch {
    return memResetPassword(input);
  }
}

export async function dbGetUser(id: string): Promise<DbUser | null> {
  try {
    const local = mem.get(id);
    if (local) return publicUser(local);
    if (!isDbConfigured()) return null;
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
  } catch {
    return null;
  }
}

export async function dbSetBalance(
  id: string,
  balance: number,
  _reason = 'admin_adjust',
) {
  const local = mem.get(id);
  if (local) {
    local.balance = Math.max(0, balance);
    return publicUser(local);
  }
  if (!isDbConfigured()) throw new Error('User not found');
  const { error } = await sb()
    .from('app_users')
    .update({ balance })
    .eq('id', id);
  if (error) throw new Error(error.message);
  const u = await dbGetUser(id);
  if (!u) throw new Error('User not found');
  return u;
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
    return { id, balance: next };
  }
  if (!isDbConfigured()) throw new Error('User not found');
  const u = await dbGetUser(id);
  if (!u) throw new Error('User not found');
  const next = Math.round((u.balance + delta) * 100) / 100;
  if (next < 0) throw new Error('Insufficient balance');
  await sb().from('app_users').update({ balance: next }).eq('id', id);
  return { id, balance: next };
}

export async function dbListUsers(): Promise<DbUser[]> {
  const fromMem = [...mem.values()].map(publicUser);
  if (!isDbConfigured()) return fromMem;
  try {
    const { data } = await sb()
      .from('app_users')
      .select('id, full_name, phone, balance, referral_code, role, banned');
    if (data?.length) return data.map(mapUser);
  } catch {
    /* */
  }
  return fromMem;
}

export async function dbEnsureAdmin(phone: string, passwordHash: string) {
  try {
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
    const existing = await sb()
      .from('app_users')
      .select('id')
      .eq('phone', phone)
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
  } catch {
    /* never throw */
  }
}
