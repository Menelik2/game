import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

const mem = new Map<string, MemUser>();

function publicUser(u: MemUser): DbUser {
  return {
    id: u.id,
    fullName: u.fullName,
    phone: u.phone,
    balance: u.balance,
    referralCode: u.referralCode,
    role: u.role,
    banned: u.banned ?? false,
  };
}

export function isDbConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return Boolean(url && key);
}

export function requireDb(): boolean {
  return process.env.REQUIRE_DB === 'true' || process.env.NODE_ENV === 'production';
}

function sb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapUser(r: Record<string, unknown>): DbUser {
  return {
    id: String(r.id),
    fullName: String(r.full_name ?? r.fullName ?? 'User'),
    phone: String(r.phone ?? ''),
    balance: Number(r.balance ?? 0),
    referralCode: String(r.referral_code ?? r.referralCode ?? ''),
    role: String(r.role ?? 'player'),
    banned: Boolean(r.banned),
  };
}

function referralCode() {
  return randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
}

function memRegister(input: {
  fullName: string;
  phone: string;
  passwordHash: string;
}): { ok: true; user: DbUser } | { ok: false; error: string } {
  for (const u of mem.values()) {
    if (u.phone === input.phone) return { ok: false, error: 'Phone already registered' };
  }
  const id = randomUUID();
  const row: MemUser = {
    id,
    fullName: input.fullName,
    phone: input.phone,
    passwordHash: input.passwordHash,
    balance: 0,
    referralCode: referralCode(),
    role: 'player',
    banned: false,
  };
  mem.set(id, row);
  return { ok: true, user: publicUser(row) };
}

/** Force balance to 0 for brand-new registrations (real-money mode). */
async function forceZeroBalance(userId: string): Promise<number> {
  try {
    if (!isDbConfigured()) return 0;
    await sb().from('app_users').update({ balance: 0 }).eq('id', userId);
  } catch {
    /* ignore */
  }
  return 0;
}

export async function dbRegister(input: {
  fullName: string;
  phone: string;
  passwordHash: string;
}): Promise<
  | { ok: true; user: DbUser; storage: 'database' | 'memory' }
  | { ok: false; error: string }
> {
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

  try {
    const { data, error } = await sb().rpc('app_register', {
      p_full_name: input.fullName,
      p_phone: input.phone,
      p_password_hash: input.passwordHash,
    });
    if (!error && data) {
      try {
        const user = mapUser(data as Record<string, unknown>);
        // Real-money: never trust RPC seed balance
        if (Number(user.balance) !== 0) {
          await forceZeroBalance(user.id);
          user.balance = 0;
        }
        return { ok: true, user, storage: 'database' };
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

  try {
    const code = referralCode();
    const { data, error } = await sb()
      .from('app_users')
      .insert({
        full_name: input.fullName,
        phone: input.phone,
        password_hash: input.passwordHash,
        balance: 0,
        referral_code: code,
        role: 'player',
        banned: false,
      })
      .select('id, full_name, phone, balance, referral_code, role, banned')
      .single();

    if (!error && data) {
      const user = mapUser(data as Record<string, unknown>);
      user.balance = 0;
      return { ok: true, user, storage: 'database' };
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
          error: `Database error: ${error.message}. Run supabase/schema.sql in Supabase SQL Editor.`,
        };
      }
    }
  } catch (e) {
    console.error('[dbRegister] insert', e);
  }

  if (requireDb()) {
    return {
      ok: false,
      error: 'Could not save user to database. Check Supabase config and schema.',
    };
  }

  const r = memRegister(input);
  if (!r.ok) return r;
  return { ok: true, user: r.user, storage: 'memory' };
}

export async function dbLogin(input: {
  phone: string;
  passwordHash: string;
}): Promise<{ ok: true; user: DbUser } | { ok: false; error: string }> {
  for (const u of mem.values()) {
    if (u.phone === input.phone && u.passwordHash === input.passwordHash) {
      if (u.banned) return { ok: false, error: 'Account banned' };
      return { ok: true, user: publicUser(u) };
    }
  }

  if (!isDbConfigured()) {
    return { ok: false, error: 'Invalid phone or password' };
  }

  try {
    const { data } = await sb().rpc('app_login', {
      p_phone: input.phone,
      p_password_hash: input.passwordHash,
    });
    if (data) {
      try {
        return { ok: true, user: mapUser(data as Record<string, unknown>) };
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
      return { ok: true, user: mapUser(data as Record<string, unknown>) };
    }
  } catch {
    /* */
  }

  return { ok: false, error: 'Invalid phone or password' };
}

export async function dbResetPassword(input: {
  phone: string;
  fullName: string;
  passwordHash: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.fullName.trim().toLowerCase();
  for (const u of mem.values()) {
    if (u.phone === input.phone && u.fullName.trim().toLowerCase() === name) {
      u.passwordHash = input.passwordHash;
      return { ok: true };
    }
  }
  if (!isDbConfigured()) return { ok: false, error: 'User not found' };
  try {
    const { data } = await sb()
      .from('app_users')
      .select('id, full_name')
      .eq('phone', input.phone)
      .maybeSingle();
    if (!data) return { ok: false, error: 'User not found' };
    if (String(data.full_name).trim().toLowerCase() !== name) {
      return { ok: false, error: 'Full name does not match' };
    }
    const { error } = await sb()
      .from('app_users')
      .update({ password_hash: input.passwordHash })
      .eq('id', data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Reset failed' };
  }
}

export async function dbGetUser(id: string): Promise<DbUser | null> {
  const local = mem.get(id);
  if (local) return publicUser(local);
  if (!isDbConfigured()) return null;
  try {
    const { data } = await sb()
      .from('app_users')
      .select('id, full_name, phone, balance, referral_code, role, banned')
      .eq('id', id)
      .maybeSingle();
    if (data) return mapUser(data as Record<string, unknown>);
  } catch {
    /* */
  }
  return null;
}

export async function dbSetBalance(
  id: string,
  balance: number,
  reason = 'admin_set',
): Promise<void> {
  const local = mem.get(id);
  if (local) local.balance = Math.max(0, balance);
  if (!isDbConfigured()) return;
  try {
    await sb().rpc('app_set_balance', {
      p_id: id,
      p_balance: balance,
      p_reason: reason,
    });
  } catch {
    await sb().from('app_users').update({ balance }).eq('id', id);
  }
}

export async function dbAdjustBalance(
  id: string,
  delta: number,
  reason = 'adjust',
): Promise<number | null> {
  const local = mem.get(id);
  if (local) {
    local.balance = Math.max(0, local.balance + delta);
  }
  if (!isDbConfigured()) return local?.balance ?? null;
  try {
    const { data } = await sb().rpc('app_adjust_balance', {
      p_id: id,
      p_delta: delta,
      p_reason: reason,
    });
    if (data && typeof data === 'object' && 'balance' in (data as object)) {
      return Number((data as { balance: number }).balance);
    }
  } catch {
    /* */
  }
  const u = await dbGetUser(id);
  if (!u) return null;
  const next = Math.max(0, u.balance + delta);
  await dbSetBalance(id, next, reason);
  return next;
}

export async function dbListUsers(): Promise<DbUser[]> {
  const fromMem = [...mem.values()].map(publicUser);
  if (!isDbConfigured()) return fromMem;
  try {
    const { data } = await sb()
      .from('app_users')
      .select('id, full_name, phone, balance, referral_code, role, banned');
    if (data?.length) return data.map((r) => mapUser(r as Record<string, unknown>));
  } catch {
    /* */
  }
  return fromMem;
}

/** Create or repair admin account in DB */
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
          balance: 0,
          referralCode: 'ADMIN001',
          role: 'admin',
          banned: false,
        });
      }
      return;
    }
    const existing = await sb()
      .from('app_users')
      .select('id, password_hash, role')
      .eq('phone', phone)
      .maybeSingle();
    if (!existing.data) {
      await sb().from('app_users').insert({
        full_name: 'Admin',
        phone,
        password_hash: passwordHash,
        balance: 0,
        referral_code: 'ADMIN001',
        role: 'admin',
      });
    } else {
      // Keep password in sync with seed hash if still default admin phone
      const updates: Record<string, unknown> = { role: 'admin' };
      if (String(existing.data.password_hash) !== passwordHash) {
        // only auto-repair known seed admin phones
        updates.password_hash = passwordHash;
      }
      await sb().from('app_users').update(updates).eq('id', existing.data.id);
    }
  } catch {
    /* never throw */
  }
}
