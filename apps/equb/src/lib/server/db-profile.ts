/**
 * Profile CRUD helpers (update / verify password / delete).
 * Uses Supabase app_users table when configured.
 * Phone number is immutable after registration.
 */
import { createClient } from '@supabase/supabase-js';
import { isDbConfigured, dbGetUser, type DbUser } from './db-users';

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return createClient(url, key, { auth: { persistSession: false } });
}

function mapUser(row: Record<string, unknown>): DbUser {
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? row.fullName ?? ''),
    phone: String(row.phone ?? ''),
    balance: Number(row.balance ?? 0),
    referralCode: String(row.referral_code ?? row.referralCode ?? ''),
    role: String(row.role ?? 'player'),
    banned: Boolean(row.banned),
  };
}

export async function dbUpdateProfile(
  id: string,
  input: {
    fullName?: string;
    /** Phone is immutable after registration — rejected if passed */
    phone?: string;
    passwordHash?: string;
  },
): Promise<{ ok: true; user: DbUser } | { ok: false; error: string }> {
  if (!isDbConfigured()) {
    return { ok: false, error: 'Database not configured' };
  }

  // Phone number cannot be changed after registration
  if (input.phone) {
    return { ok: false, error: 'Phone number cannot be changed' };
  }

  const patch: Record<string, unknown> = {};
  if (input.fullName && input.fullName.trim().length >= 2) {
    patch.full_name = input.fullName.trim().slice(0, 80);
  }
  if (input.passwordHash) patch.password_hash = input.passwordHash;

  if (Object.keys(patch).length === 0) {
    const u = await dbGetUser(id);
    if (!u) return { ok: false, error: 'User not found' };
    return { ok: true, user: u };
  }

  try {
    const { data, error } = await sb()
      .from('app_users')
      .update(patch)
      .eq('id', id)
      .select('id, full_name, phone, balance, referral_code, role, banned')
      .single();

    if (error) {
      return { ok: false, error: error.message || 'Update failed' };
    }
    if (!data) return { ok: false, error: 'User not found' };
    return { ok: true, user: mapUser(data as Record<string, unknown>) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Update failed' };
  }
}

export async function dbVerifyPassword(
  id: string,
  passwordHash: string,
): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    const { data } = await sb()
      .from('app_users')
      .select('password_hash')
      .eq('id', id)
      .maybeSingle();
    return Boolean(data && String(data.password_hash) === passwordHash);
  } catch {
    return false;
  }
}

export async function dbDeleteUser(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDbConfigured()) {
    return { ok: false, error: 'Database not configured' };
  }
  try {
    const { error } = await sb().from('app_users').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delete failed' };
  }
}
