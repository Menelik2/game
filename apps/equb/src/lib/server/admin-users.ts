import { createHash, randomUUID } from 'crypto';
import { dbListUsers, dbSetBalance, isDbConfigured } from './db-users';
import { createClient } from '@supabase/supabase-js';

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}
function hash(pw: string) {
  return createHash('sha256').update(pw).digest('hex');
}

export async function adminList() {
  return dbListUsers();
}

export async function adminCreate(input: { fullName: string; phone: string; password: string; balance?: number; role?: string }) {
  const phone = String(input.phone || '').replace(/\D/g, '');
  if (phone.length < 9) throw new Error('Phone required');
  if (!input.password || input.password.length < 4) throw new Error('Password too short');
  const row = {
    id: randomUUID(),
    full_name: input.fullName || 'Player',
    phone,
    password_hash: hash(input.password),
    balance: Number(input.balance || 100),
    referral_code: `U${phone.slice(-4)}${Date.now().toString(36).slice(-3)}`.toUpperCase(),
    role: input.role === 'admin' ? 'admin' : 'player',
    banned: false,
  };
  if (!isDbConfigured()) throw new Error('Database not configured');
  const { error } = await sb().from('app_users').insert(row);
  if (error) throw new Error(error.message);
  return row;
}

export async function adminUpdate(id: string, patch: { fullName?: string; phone?: string; role?: string; banned?: boolean; balance?: number }) {
  const update: Record<string, unknown> = {};
  if (patch.fullName) update.full_name = patch.fullName;
  if (patch.phone) update.phone = String(patch.phone).replace(/\D/g, '');
  if (patch.role) update.role = patch.role === 'admin' ? 'admin' : 'player';
  if (typeof patch.banned === 'boolean') update.banned = patch.banned;
  if (Object.keys(update).length && isDbConfigured()) {
    const { error } = await sb().from('app_users').update(update).eq('id', id);
    if (error) throw new Error(error.message);
  }
  if (patch.balance != null) await dbSetBalance(id, Number(patch.balance), 'admin_set');
  return { id, ...update, balance: patch.balance };
}

export async function adminDelete(id: string) {
  if (!isDbConfigured()) throw new Error('Database not configured');
  const { error } = await sb().from('app_users').delete().eq('id', id);
  if (error) throw new Error(error.message);
  return { id };
}
