/**
 * Persist withdrawals across serverless instances (Supabase + memory fallback).
 */

import { createClient } from '@supabase/supabase-js';
import { isDbConfigured } from '@/lib/server/db-users';

export type WithdrawalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PAID'
  | 'REJECTED'
  | 'CANCELLED';

export type StoredWithdrawal = {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  amount: number;
  currency: 'ETB';
  /** Player Telebirr number to receive the payout */
  payoutPhone: string;
  status: WithdrawalStatus;
  adminNote: string | null;
  paidBy: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
};

const g = globalThis as unknown as {
  __withdrawals?: Map<string, StoredWithdrawal>;
};
if (!g.__withdrawals) g.__withdrawals = new Map();

function mem() {
  return g.__withdrawals!;
}

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return createClient(url, key, { auth: { persistSession: false } });
}

function rowTo(r: Record<string, unknown>): StoredWithdrawal {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    userName: String(r.user_name || ''),
    userPhone: String(r.user_phone || ''),
    amount: Number(r.amount),
    currency: 'ETB',
    payoutPhone: String(r.payout_phone || ''),
    status: String(r.status) as WithdrawalStatus,
    adminNote: r.admin_note ? String(r.admin_note) : null,
    paidBy: r.paid_by ? String(r.paid_by) : null,
    createdAt: String(r.created_at || new Date().toISOString()),
    updatedAt: String(r.updated_at || new Date().toISOString()),
    paidAt: r.paid_at ? String(r.paid_at) : null,
  };
}

function toRow(w: StoredWithdrawal) {
  return {
    id: w.id,
    user_id: w.userId,
    user_name: w.userName,
    user_phone: w.userPhone,
    amount: w.amount,
    currency: w.currency,
    payout_phone: w.payoutPhone,
    status: w.status,
    admin_note: w.adminNote,
    paid_by: w.paidBy,
    created_at: w.createdAt,
    updated_at: w.updatedAt,
    paid_at: w.paidAt,
  };
}

export async function dbSaveWithdrawal(w: StoredWithdrawal): Promise<void> {
  mem().set(w.id, w);
  if (!isDbConfigured()) return;
  try {
    await sb().from('wallet_withdrawals').upsert(toRow(w), { onConflict: 'id' });
  } catch {
    /* memory still holds it */
  }
}

export async function dbGetWithdrawal(
  id: string,
): Promise<StoredWithdrawal | null> {
  const local = mem().get(id);
  if (local) return local;
  if (!isDbConfigured()) return null;
  try {
    const { data, error } = await sb()
      .from('wallet_withdrawals')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    const w = rowTo(data as Record<string, unknown>);
    mem().set(w.id, w);
    return w;
  } catch {
    return null;
  }
}

export async function dbListWithdrawals(opts?: {
  userId?: string;
  status?: WithdrawalStatus;
  limit?: number;
}): Promise<StoredWithdrawal[]> {
  const limit = Math.min(200, Math.max(1, opts?.limit || 50));
  if (isDbConfigured()) {
    try {
      let q = sb()
        .from('wallet_withdrawals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (opts?.userId) q = q.eq('user_id', opts.userId);
      if (opts?.status) q = q.eq('status', opts.status);
      const { data, error } = await q;
      if (!error && data) {
        const rows = (data as Record<string, unknown>[]).map(rowTo);
        for (const w of rows) mem().set(w.id, w);
        return rows;
      }
    } catch {
      /* fall through */
    }
  }
  let all = [...mem().values()];
  if (opts?.userId) all = all.filter((w) => w.userId === opts.userId);
  if (opts?.status) all = all.filter((w) => w.status === opts.status);
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return all.slice(0, limit);
}
