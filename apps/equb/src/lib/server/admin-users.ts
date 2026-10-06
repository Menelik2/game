import { randomUUID } from 'crypto';
import { dbListUsers, dbSetBalance, isDbConfigured } from './db-users';
import { hashPassword, normalizePhone } from '@/lib/password';
import { createClient } from '@supabase/supabase-js';

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function adminList() {
  return dbListUsers();
}

export async function adminCreate(input: {
  fullName: string;
  phone: string;
  password: string;
  balance?: number;
  role?: string;
}) {
  const phone = normalizePhone(String(input.phone || ''));
  if (!phone) throw new Error('Valid phone required (09xxxxxxxx)');
  if (!input.password || input.password.length < 6) throw new Error('Password must be at least 6 characters'); // min
  const row = {
    id: randomUUID(),
    full_name: input.fullName || 'Player',
    phone,
    password_hash: hashPassword(input.password),
    balance: Number(input.balance ?? 0),
    referral_code: `U${phone.slice(-4)}${Date.now().toString(36).slice(-3)}`.toUpperCase(),
    role: input.role === 'admin' ? 'admin' : 'player',
    banned: false,
  };
  if (!isDbConfigured()) throw new Error('Database not configured');
  const { error } = await sb().from('app_users').insert(row);
  if (error) throw new Error(error.message);
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    balance: row.balance,
    role: row.role,
    banned: false,
  };
}

export async function adminUpdate(
  id: string,
  patch: {
    fullName?: string;
    phone?: string;
    role?: string;
    banned?: boolean;
    balance?: number;
    password?: string;
  },
) {
  if (!isDbConfigured()) throw new Error('Database not configured');
  const update: Record<string, unknown> = {};
  if (patch.fullName != null && String(patch.fullName).trim().length >= 2) {
    update.full_name = String(patch.fullName).trim();
  }
  if (patch.phone != null && String(patch.phone).trim()) {
    const phone = normalizePhone(String(patch.phone));
    if (!phone) throw new Error('Invalid phone number');
    const { data: existing } = await sb().from('app_users').select('id').eq('phone', phone).maybeSingle();
    if (existing && String(existing.id) !== id) throw new Error('Phone already used by another account');
    update.phone = phone;
  }
  if (patch.role) update.role = patch.role === 'admin' ? 'admin' : 'player';
  if (typeof patch.banned === 'boolean') update.banned = patch.banned;
  if (patch.password != null && String(patch.password).length > 0) {
    if (String(patch.password).length < 6) throw new Error('Password must be at least 6 characters'); // min
    update.password_hash = hashPassword(String(patch.password));
  }
  if (Object.keys(update).length > 0) {
    const { error } = await sb().from('app_users').update(update).eq('id', id);
    if (error) throw new Error(error.message);
  }
  if (patch.balance != null && Number.isFinite(Number(patch.balance))) {
    await dbSetBalance(id, Number(patch.balance), 'admin_set');
  }
  const { data } = await sb()
    .from('app_users')
    .select('id, full_name, phone, balance, referral_code, role, banned')
    .eq('id', id)
    .maybeSingle();
  if (!data) throw new Error('User not found after update');
  return {
    id: String(data.id),
    fullName: String(data.full_name),
    phone: String(data.phone),
    balance: Number(data.balance),
    referralCode: String(data.referral_code || ''),
    role: String(data.role || 'player'),
    banned: Boolean(data.banned),
  };
}

export async function adminDelete(id: string) {
  if (!isDbConfigured()) throw new Error('Database not configured');
  const { error } = await sb().from('app_users').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { id };
}
