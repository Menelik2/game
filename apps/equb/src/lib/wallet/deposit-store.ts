/**
 * Persist deposits so admin approve works across Vercel serverless instances.
 */

import { createClient } from '@supabase/supabase-js';
import { isDbConfigured } from '@/lib/server/db-users';

export type StoredDepositStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REVERSED'
  | 'REVIEW_REQUIRED';

export type StoredDeposit = {
  id: string;
  userId: string;
  amount: number;
  currency: 'ETB';
  status: StoredDepositStatus;
  merchantOrderId: string;
  transactionNumber: string | null;
  providerTransactionId: string | null;
  checkoutUrl: string | null;
  failureReason: string | null;
  verificationAttempts: number;
  createdAt: string;
  confirmedAt: string | null;
  adminNote?: string | null;
};

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return createClient(url, key, { auth: { persistSession: false } });
}

function rowToDeposit(r: Record<string, unknown>): StoredDeposit {
  return {
    id: String(r.id),
    userId: String(r.user_id),
    amount: Number(r.amount),
    currency: 'ETB',
    status: String(r.status) as StoredDepositStatus,
    merchantOrderId: String(r.merchant_order_id || ''),
    transactionNumber: r.transaction_number
      ? String(r.transaction_number)
      : null,
    providerTransactionId: r.provider_transaction_id
      ? String(r.provider_transaction_id)
      : null,
    checkoutUrl: r.checkout_url ? String(r.checkout_url) : null,
    failureReason: r.failure_reason ? String(r.failure_reason) : null,
    verificationAttempts: Number(r.verification_attempts || 0),
    createdAt: String(r.created_at || new Date().toISOString()),
    confirmedAt: r.confirmed_at ? String(r.confirmed_at) : null,
    adminNote: r.admin_note ? String(r.admin_note) : null,
  };
}

function depositToRow(d: StoredDeposit) {
  return {
    id: d.id,
    user_id: d.userId,
    amount: d.amount,
    currency: d.currency,
    status: d.status,
    merchant_order_id: d.merchantOrderId,
    transaction_number: d.transactionNumber,
    provider_transaction_id: d.providerTransactionId,
    checkout_url: d.checkoutUrl,
    failure_reason: d.failureReason,
    verification_attempts: d.verificationAttempts,
    created_at: d.createdAt,
    confirmed_at: d.confirmedAt,
    admin_note: d.adminNote ?? null,
  };
}

export async function dbSaveDeposit(d: StoredDeposit): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await sb().from('wallet_deposits').upsert(depositToRow(d), { onConflict: 'id' });
  } catch (e) {
    console.error('[deposit-store] save', e);
  }
}

export async function dbGetDeposit(id: string): Promise<StoredDeposit | null> {
  if (!isDbConfigured()) return null;
  try {
    const { data, error } = await sb()
      .from('wallet_deposits')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToDeposit(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function dbListDeposits(userId?: string): Promise<StoredDeposit[]> {
  if (!isDbConfigured()) return [];
  try {
    let q = sb()
      .from('wallet_deposits')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (userId) q = q.eq('user_id', userId);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowToDeposit);
  } catch {
    return [];
  }
}

export async function dbTxnUsed(txn: string): Promise<boolean> {
  if (!isDbConfigured() || !txn) return false;
  try {
    const { data } = await sb()
      .from('wallet_deposits')
      .select('id')
      .eq('status', 'CONFIRMED')
      .or(`transaction_number.eq.${txn},provider_transaction_id.eq.${txn}`)
      .limit(1);
    return Boolean(data && data.length > 0);
  } catch {
    return false;
  }
}
