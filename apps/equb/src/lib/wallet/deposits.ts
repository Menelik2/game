import { randomUUID } from 'crypto';
import { publicWalletConfig, verifyEtConfig } from '@/lib/verify-et/config';
import { verifyTelebirrWithVerifyEt } from '@/lib/verify-et/service';
import { dbAdjustBalance, dbGetUser, isDbConfigured } from '@/lib/server/db-users';
import { applyDelta, ensureWallet, setBalance } from '@/lib/server/wallets';
import {
  dbSaveDeposit,
  dbGetDeposit,
  dbListDeposits,
  dbTxnUsed,
} from '@/lib/wallet/deposit-store';

export type DepositStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REVERSED'
  | 'REVIEW_REQUIRED';

export type Deposit = {
  id: string;
  userId: string;
  amount: number;
  currency: 'ETB';
  status: DepositStatus;
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

type Wallet = { userId: string; balance: number; withdrawable: number };

const g = globalThis as unknown as {
  __dep?: Map<string, Deposit>;
  __usedTxn?: Set<string>;
  __wallets?: Map<string, Wallet>;
};
if (!g.__dep) g.__dep = new Map();
if (!g.__usedTxn) g.__usedTxn = new Set();
if (!g.__wallets) g.__wallets = new Map();

export async function resolveBalance(userId: string): Promise<number> {
  try {
    if (isDbConfigured()) {
      const u = await dbGetUser(userId);
      if (u) return Number(u.balance || 0);
    }
  } catch {
    /* */
  }
  try {
    const w = ensureWallet(userId);
    return Number(w.balance || 0);
  } catch {
    return 0;
  }
}

function walletOf(userId: string): Wallet {
  let w = g.__wallets!.get(userId);
  if (!w) {
    w = { userId, balance: 0, withdrawable: 0 };
    g.__wallets!.set(userId, w);
  }
  return w;
}

async function rememberDeposit(d: Deposit) {
  g.__dep!.set(d.id, d);
  await dbSaveDeposit(d);
}

async function findDeposit(id: string): Promise<Deposit | null> {
  const mem = g.__dep!.get(id);
  if (mem) return mem;
  try {
    const row = await dbGetDeposit(id);
    if (row) {
      g.__dep!.set(row.id, row);
      return row;
    }
  } catch {
    /* */
  }
  return null;
}

async function isTxnUsed(txn: string): Promise<boolean> {
  if (g.__usedTxn!.has(txn)) return true;
  try {
    if (await dbTxnUsed(txn)) return true;
  } catch {
    /* */
  }
  return false;
}

async function markTxnUsed(txn: string) {
  g.__usedTxn!.add(txn);
}

async function creditConfirmed(
  d: Deposit,
  txn: string,
  amount: number,
) {
  if (d.status === 'CONFIRMED') {
    return {
      ok: true as const,
      status: 'CONFIRMED' as const,
      message: 'Already confirmed',
      deposit: d,
      balance: await resolveBalance(d.userId),
    };
  }

  if (await isTxnUsed(txn)) {
    d.status = 'FAILED';
    d.failureReason = 'Transaction already used';
    await rememberDeposit(d);
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'This Telebirr transaction was already credited',
      deposit: d,
    };
  }

  const creditAmt = amount > 0 ? amount : d.amount;
  if (!(creditAmt > 0)) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'Invalid amount',
      deposit: d,
    };
  }

  try {
    if (isDbConfigured()) {
      await dbAdjustBalance(d.userId, creditAmt, `deposit:${txn}`);
    } else {
      applyDelta(d.userId, creditAmt, `deposit:${txn}`);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Credit failed';
    d.status = 'FAILED';
    d.failureReason = message;
    await rememberDeposit(d);
    return { ok: false as const, status: 'FAILED' as const, message, deposit: d };
  }

  d.status = 'CONFIRMED';
  d.amount = creditAmt;
  d.transactionNumber = txn;
  d.providerTransactionId = txn;
  d.confirmedAt = new Date().toISOString();
  d.failureReason = null;
  await rememberDeposit(d);
  await markTxnUsed(txn);

  return {
    ok: true as const,
    status: 'CONFIRMED' as const,
    message: 'Deposit confirmed',
    deposit: d,
    balance: await resolveBalance(d.userId),
  };
}

export async function createDeposit(input: {
  userId: string;
  amount: number;
  merchantOrderId?: string;
}): Promise<Deposit> {
  const now = new Date().toISOString();
  const d: Deposit = {
    id: randomUUID(),
    userId: input.userId,
    amount: input.amount,
    currency: 'ETB',
    status: 'PENDING',
    merchantOrderId: input.merchantOrderId || `ord_${Date.now()}`,
    transactionNumber: null,
    providerTransactionId: null,
    checkoutUrl: null,
    failureReason: null,
    verificationAttempts: 0,
    createdAt: now,
    confirmedAt: null,
  };
  await rememberDeposit(d);
  return d;
}

export async function adminConfirmDeposit(input: {
  depositId: string;
  transactionNumber?: string;
  note?: string;
}) {
  const d = await findDeposit(input.depositId);
  if (!d) {
    return { ok: false as const, message: 'Deposit not found' };
  }
  if (d.status === 'CONFIRMED') {
    return {
      ok: true as const,
      message: 'Already confirmed',
      deposit: d,
      balance: await resolveBalance(d.userId),
    };
  }
  const txn =
    input.transactionNumber ||
    d.transactionNumber ||
    d.providerTransactionId ||
    d.merchantOrderId;
  if (input.note) d.adminNote = input.note;
  await rememberDeposit(d);
  return creditConfirmed(d, txn, d.amount);
}

export async function adminRejectDeposit(input: {
  depositId: string;
  reason?: string;
}) {
  const d = await findDeposit(input.depositId);
  if (!d) {
    return { ok: false as const, message: 'Deposit not found' };
  }
  if (d.status === 'CONFIRMED') {
    return {
      ok: false as const,
      message: 'Cannot reject a confirmed deposit',
      deposit: d,
    };
  }
  d.status = 'FAILED';
  d.failureReason = input.reason || 'Rejected by admin';
  d.adminNote = input.reason || d.adminNote;
  await rememberDeposit(d);
  return { ok: true as const, message: 'Rejected', deposit: d };
}

export function listDeposits(userId?: string): Deposit[] {
  const all = [...g.__dep!.values()];
  if (!userId) return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return all
    .filter((d) => d.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listDepositsAsync(userId?: string): Promise<Deposit[]> {
  try {
    const fromDb = await dbListDeposits(userId);
    for (const d of fromDb) g.__dep!.set(d.id, d);
  } catch {
    /* */
  }
  return listDeposits(userId);
}

export async function verifyDeposit(input: {
  depositId: string;
  transactionNumber?: string;
}) {
  const d = await findDeposit(input.depositId);
  if (!d) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'Deposit not found',
    };
  }
  if (d.status === 'CONFIRMED') {
    return {
      ok: true as const,
      status: 'CONFIRMED' as const,
      message: 'Already confirmed',
      deposit: d,
    };
  }

  const txn = (input.transactionNumber || d.transactionNumber || '').trim();
  if (txn.length < 6) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'Transaction number required',
      deposit: d,
    };
  }

  d.verificationAttempts += 1;
  d.transactionNumber = txn;
  d.status = 'PROCESSING';
  await rememberDeposit(d);

  const cfg = verifyEtConfig();
  if (!cfg.apiKey && !publicWalletConfig().telebirrMerchantPhone) {
    d.status = 'REVIEW_REQUIRED';
    d.failureReason = 'Payment verification not configured';
    await rememberDeposit(d);
    return {
      ok: false as const,
      status: 'REVIEW_REQUIRED' as const,
      message: 'Payment verification not configured',
      deposit: d,
    };
  }

  const result = await verifyTelebirrWithVerifyEt({
    transactionNumber: txn,
    expectedAmount: d.amount,
  });

  if (result.ok || (result as { verified?: boolean }).verified) {
    const amt =
      Number((result as { amount?: number }).amount) > 0
        ? Number((result as { amount?: number }).amount)
        : d.amount;
    return creditConfirmed(d, txn, amt);
  }

  const msg = (result as { message?: string }).message || 'Verification failed';
  d.status = 'FAILED';
  d.failureReason = msg;
  await rememberDeposit(d);
  return {
    ok: false as const,
    status: 'FAILED' as const,
    message: msg,
    deposit: d,
  };
}

export type CreditFromWebhookInput = {
  depositId?: string;
  merchantOrderId?: string;
  transactionNumber?: string;
  amount?: number;
  providerTransactionId?: string;
  currency?: string;
};

export async function creditFromWebhook(input: CreditFromWebhookInput) {
  let d: Deposit | null = null;
  if (input.depositId) {
    d = await findDeposit(input.depositId);
    if (!d) {
      const orderId = input.depositId.trim();
      if (orderId) {
        const all = await listDepositsAsync();
        d =
          all.find(
            (x) => x.merchantOrderId === orderId || x.id === orderId,
          ) || null;
      }
    }
  }

  if (!d && input.merchantOrderId) {
    const orderId = input.merchantOrderId.trim();
    if (orderId) {
      const all = await listDepositsAsync();
      d =
        all.find(
          (x) => x.merchantOrderId === orderId || x.id === orderId,
        ) || null;
    }
  }

  if (!d && input.transactionNumber) {
    const all = await listDepositsAsync();
    d =
      all.find(
        (x) =>
          x.transactionNumber === input.transactionNumber ||
          x.providerTransactionId === input.transactionNumber,
      ) || null;
  }

  if (!d && input.providerTransactionId) {
    const all = await listDepositsAsync();
    d =
      all.find(
        (x) =>
          x.providerTransactionId === input.providerTransactionId ||
          x.transactionNumber === input.providerTransactionId,
      ) || null;
  }

  if (!d) {
    return { ok: false as const, message: 'Deposit not found for webhook' };
  }

  const txn =
    input.providerTransactionId ||
    input.transactionNumber ||
    d.transactionNumber ||
    d.merchantOrderId ||
    d.id;
  const amt = input.amount && input.amount > 0 ? input.amount : d.amount;
  return creditConfirmed(d, String(txn), amt);
}

export async function claimByTransactionNumber(input: {
  userId: string;
  transactionNumber: string;
  amount?: number;
}) {
  const txn = input.transactionNumber.trim();
  if (txn.length < 6) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'Enter a valid Telebirr transaction number.',
    };
  }

  const existing = (await listDepositsAsync()).find(
    (x) =>
      (x.transactionNumber === txn || x.providerTransactionId === txn) &&
      x.status === 'CONFIRMED',
  );
  if (existing) {
    return {
      ok: false as const,
      status: 'CONFIRMED' as const,
      message: 'This transaction was already credited',
      deposit: existing,
    };
  }

  if (await isTxnUsed(txn)) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'This Telebirr transaction was already used',
    };
  }

  const cfg = verifyEtConfig();
  if (!cfg.apiKey && !publicWalletConfig().telebirrMerchantPhone) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'Payment verification not configured',
    };
  }

  const result = await verifyTelebirrWithVerifyEt({
    transactionNumber: txn,
    expectedAmount: input.amount && input.amount > 0 ? input.amount : 0,
  });

  if (!result.ok && !(result as { verified?: boolean }).verified) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: (result as { message?: string }).message || 'Verification failed',
    };
  }

  const amount =
    Number((result as { amount?: number }).amount) > 0
      ? Number((result as { amount?: number }).amount)
      : input.amount && input.amount > 0
        ? input.amount
        : 0;

  if (!(amount > 0)) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'Could not determine deposit amount from transaction',
    };
  }

  const d = await createDeposit({
    userId: input.userId,
    amount,
    merchantOrderId: `claim_${txn.slice(0, 12)}`,
  });
  d.transactionNumber = txn;
  d.providerTransactionId = txn;
  await rememberDeposit(d);

  return creditConfirmed(d, txn, amount);
}

export { publicWalletConfig };
