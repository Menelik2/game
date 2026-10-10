/**
 * Player withdrawals → paid out to player's Telebirr by admin
 * from the merchant Telebirr wallet (manual send).
 */

import { randomUUID } from 'crypto';
import {
  dbAdjustBalance,
  dbGetUser,
  isDbConfigured,
} from '@/lib/server/db-users';
import { applyDelta, ensureWallet } from '@/lib/server/wallets';
import { getPlatformSettings } from '@/lib/server/platform-settings';
import { telebirrPublicConfig } from '@/lib/telebirr/config';
import {
  dbSaveWithdrawal,
  dbGetWithdrawal,
  dbListWithdrawals,
  type StoredWithdrawal,
  type WithdrawalStatus,
} from './withdrawal-store';

export type { StoredWithdrawal as Withdrawal, WithdrawalStatus };

function normalizePhone(raw: string): string | null {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('09')) return d;
  if (d.length === 12 && d.startsWith('2519')) return '0' + d.slice(3);
  if (d.length === 9 && d.startsWith('9')) return '0' + d;
  return null;
}

async function debitUser(userId: string, amount: number): Promise<number> {
  if (isDbConfigured()) {
    const next = await dbAdjustBalance(userId, -amount);
    if (next == null) throw new Error('User not found');
    return next;
  }
  ensureWallet(userId);
  return applyDelta(userId, -amount);
}

async function creditUser(userId: string, amount: number): Promise<number> {
  if (isDbConfigured()) {
    const next = await dbAdjustBalance(userId, amount);
    if (next == null) throw new Error('User not found');
    return next;
  }
  ensureWallet(userId);
  return applyDelta(userId, amount);
}

export async function createWithdrawal(input: {
  userId: string;
  amount: number;
  payoutPhone: string;
}): Promise<
  | { ok: true; withdrawal: StoredWithdrawal; balance: number }
  | { ok: false; message: string }
> {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  const settings = getPlatformSettings();
  const minW = Math.max(10, Number(settings.minDepositEtb) || 50);
  const maxW = Math.max(minW, Number(settings.maxDepositEtb) || 100_000);

  if (!Number.isFinite(amount) || amount < minW) {
    return { ok: false, message: `Minimum withdrawal is ${minW} ETB` };
  }
  if (amount > maxW) {
    return { ok: false, message: `Maximum withdrawal is ${maxW} ETB` };
  }

  const payoutPhone = normalizePhone(input.payoutPhone);
  if (!payoutPhone) {
    return {
      ok: false,
      message: 'Enter a valid Ethiopian Telebirr number (09xxxxxxxx)',
    };
  }

  const user = isDbConfigured() ? await dbGetUser(input.userId) : null;
  const bal = user
    ? Number(user.balance)
    : Number(ensureWallet(input.userId).balance);
  if (!Number.isFinite(bal) || bal < amount) {
    return {
      ok: false,
      message: `Insufficient balance (have ${Number(bal || 0).toFixed(2)} ETB)`,
    };
  }

  // Debit immediately so funds are held until admin pays or rejects
  let balance: number;
  try {
    balance = await debitUser(input.userId, amount);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Could not debit balance',
    };
  }

  const now = new Date().toISOString();
  const withdrawal: StoredWithdrawal = {
    id: randomUUID(),
    userId: input.userId,
    userName: user?.fullName || 'Player',
    userPhone: user?.phone || '',
    amount,
    currency: 'ETB',
    payoutPhone,
    status: 'PENDING',
    adminNote: null,
    paidBy: null,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  };

  await dbSaveWithdrawal(withdrawal);
  return { ok: true, withdrawal, balance };
}

export async function listUserWithdrawals(userId: string) {
  return dbListWithdrawals({ userId, limit: 50 });
}

export async function listAllWithdrawals(status?: WithdrawalStatus) {
  return dbListWithdrawals({ status, limit: 100 });
}

/** Admin marks as paid after sending ETB via Telebirr to payoutPhone */
export async function adminMarkPaid(input: {
  withdrawalId: string;
  adminId: string;
  note?: string;
}): Promise<
  | { ok: true; withdrawal: StoredWithdrawal; message: string }
  | { ok: false; message: string; withdrawal?: StoredWithdrawal }
> {
  const w = await dbGetWithdrawal(input.withdrawalId);
  if (!w) return { ok: false, message: 'Withdrawal not found' };
  if (w.status === 'PAID') {
    return { ok: true, withdrawal: w, message: 'Already marked paid' };
  }
  if (w.status === 'REJECTED' || w.status === 'CANCELLED') {
    return { ok: false, message: `Cannot pay a ${w.status} withdrawal`, withdrawal: w };
  }

  w.status = 'PAID';
  w.paidBy = input.adminId;
  w.paidAt = new Date().toISOString();
  w.updatedAt = w.paidAt;
  w.adminNote = input.note ? String(input.note).slice(0, 200) : w.adminNote;
  await dbSaveWithdrawal(w);

  return {
    ok: true,
    withdrawal: w,
    message: `Paid ${w.amount} ETB to Telebirr ${w.payoutPhone}`,
  };
}

/** Reject and refund player balance */
export async function adminRejectWithdrawal(input: {
  withdrawalId: string;
  adminId: string;
  reason?: string;
}): Promise<
  | { ok: true; withdrawal: StoredWithdrawal; balance: number; message: string }
  | { ok: false; message: string; withdrawal?: StoredWithdrawal }
> {
  const w = await dbGetWithdrawal(input.withdrawalId);
  if (!w) return { ok: false, message: 'Withdrawal not found' };
  if (w.status === 'PAID') {
    return { ok: false, message: 'Already paid — cannot reject', withdrawal: w };
  }
  if (w.status === 'REJECTED' || w.status === 'CANCELLED') {
    return { ok: true, withdrawal: w, balance: 0, message: 'Already closed' };
  }

  let balance = 0;
  try {
    balance = await creditUser(w.userId, w.amount);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Refund failed',
      withdrawal: w,
    };
  }

  w.status = 'REJECTED';
  w.updatedAt = new Date().toISOString();
  w.adminNote = (input.reason || 'Rejected by admin').slice(0, 200);
  w.paidBy = input.adminId;
  await dbSaveWithdrawal(w);

  return {
    ok: true,
    withdrawal: w,
    balance,
    message: `Rejected — ${w.amount} ETB refunded to player`,
  };
}

export function withdrawalPublicInfo() {
  const merchant = telebirrPublicConfig();
  const settings = getPlatformSettings();
  return {
    minWithdraw: Math.max(10, settings.minDepositEtb || 50),
    maxWithdraw: Math.max(50, settings.maxDepositEtb || 100_000),
    merchantPhone: merchant.merchantPhone,
    merchantName: merchant.merchantName,
    instruction:
      'Admin sends your withdrawal to the Telebirr number you provide. Funds are held from your balance until paid or rejected.',
  };
}
