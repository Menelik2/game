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
  const db = await dbGetDeposit(id);
  if (db) {
    const d = db as Deposit;
    g.__dep!.set(d.id, d);
    return d;
  }
  return null;
}

function parseAmount(amount: unknown, min: number, max: number) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  if (rounded < min || rounded > max) return null;
  return rounded;
}

export async function createDeposit(input: {
  userId: string;
  amount: unknown;
  origin: string;
}) {
  const cfg = verifyEtConfig();
  const amount = parseAmount(input.amount, cfg.minDeposit, cfg.maxDeposit);
  if (amount == null) {
    return {
      ok: false as const,
      message: `Amount must be between ${cfg.minDeposit} and ${cfg.maxDeposit} ETB.`,
    };
  }
  const id = randomUUID();
  const merchantOrderId =
    `EQ${Date.now().toString(36)}${id.slice(0, 6)}`.toUpperCase();
  const deposit: Deposit = {
    id,
    userId: input.userId,
    amount,
    currency: 'ETB',
    status: 'PENDING',
    merchantOrderId,
    transactionNumber: null,
    providerTransactionId: null,
    checkoutUrl: null,
    failureReason: null,
    verificationAttempts: 0,
    createdAt: new Date().toISOString(),
    confirmedAt: null,
    adminNote: null,
  };
  await rememberDeposit(deposit);
  return {
    ok: true as const,
    deposit,
    checkoutUrl: null,
    config: publicWalletConfig(),
  };
}

async function creditConfirmed(
  d: Deposit,
  providerTxn: string,
  amount: number,
) {
  const usedDb = await dbTxnUsed(providerTxn);
  if (g.__usedTxn!.has(providerTxn) || usedDb || d.status === 'CONFIRMED') {
    const bal = await resolveBalance(d.userId);
    return {
      ok: false as const,
      status: 'CONFIRMED' as const,
      message: 'This transaction has already been used.',
      deposit: d,
      balance: bal,
    };
  }

  const before = await resolveBalance(d.userId);
  const creditAmt = Math.round(Number(amount) * 100) / 100;
  if (!Number.isFinite(creditAmt) || creditAmt <= 0) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'Invalid credit amount.',
      deposit: d,
    };
  }

  let after = Math.round((before + creditAmt) * 100) / 100;
  try {
    if (isDbConfigured()) {
      const r = await dbAdjustBalance(d.userId, creditAmt, 'deposit_telebirr');
      if (typeof r === 'number' && Number.isFinite(r)) after = r;
      else if (r && typeof r === 'object' && 'balance' in (r as object)) {
        after = Number((r as { balance: number }).balance);
      }
    }
  } catch {
    after = Math.round((before + creditAmt) * 100) / 100;
  }

  try {
    setBalance(d.userId, after);
  } catch {
    try {
      applyDelta(d.userId, creditAmt, 'deposit_telebirr');
    } catch {
      /* ignore */
    }
  }

  const w = walletOf(d.userId);
  w.balance = after;
  w.withdrawable = after;

  d.status = 'CONFIRMED';
  d.providerTransactionId = providerTxn;
  d.confirmedAt = new Date().toISOString();
  d.failureReason = null;
  g.__usedTxn!.add(providerTxn);
  if (d.transactionNumber) g.__usedTxn!.add(d.transactionNumber);
  await rememberDeposit(d);

  return {
    ok: true as const,
    status: 'CONFIRMED' as const,
    message: 'Deposit confirmed — balance updated',
    deposit: d,
    balance: after,
    balanceBefore: before,
  };
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
    const bal = await resolveBalance(d.userId);
    return {
      ok: false as const,
      message: 'Already confirmed',
      deposit: d,
      balance: bal,
    };
  }
  if (input.transactionNumber) {
    d.transactionNumber = input.transactionNumber.trim();
  }
  const txn =
    d.transactionNumber ||
    d.providerTransactionId ||
    `ADMIN-${d.id.slice(0, 8)}`;
  if (input.note) d.adminNote = input.note;
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
  await rememberDeposit(d);
  return { ok: true as const, deposit: d };
}

export function listDeposits(userId?: string) {
  const all = [...g.__dep!.values()].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  if (!userId) return all;
  return all.filter((d) => d.userId === userId);
}

/** Async list — merges memory + database for admin dashboard. */
export async function listDepositsAsync(userId?: string): Promise<Deposit[]> {
  const fromDb = await dbListDeposits(userId);
  for (const d of fromDb) {
    if (!g.__dep!.has(d.id)) g.__dep!.set(d.id, d as Deposit);
  }
  return listDeposits(userId);
}

export async function verifyDeposit(input: {
  depositId: string;
  userId: string;
  transactionNumber: string;
}) {
  const d = await findDeposit(input.depositId);
  if (!d || d.userId !== input.userId) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'Deposit not found',
    };
  }
  if (d.status === 'CONFIRMED') {
    const bal = await resolveBalance(d.userId);
    return {
      ok: true as const,
      status: 'CONFIRMED' as const,
      message: 'Already confirmed',
      deposit: d,
      balance: bal,
    };
  }

  const txn = input.transactionNumber.trim();
  if (txn.length < 6) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'Enter a valid Telebirr transaction number.',
    };
  }

  d.transactionNumber = txn;
  d.verificationAttempts = (d.verificationAttempts || 0) + 1;
  d.status = 'PROCESSING';
  await rememberDeposit(d);

  const result = await verifyTelebirrWithVerifyEt({
    transactionNumber: txn,
    expectedAmount: d.amount,
  });

  if (result.status === 'UNAVAILABLE' || result.status === 'PROCESSING') {
    d.status = 'REVIEW_REQUIRED';
    d.failureReason = result.message;
    await rememberDeposit(d);
    return {
      ok: false as const,
      status: 'REVIEW_REQUIRED' as const,
      message: result.message,
      deposit: d,
    };
  }

  if (result.verified && result.status === 'CONFIRMED') {
    return creditConfirmed(
      d,
      result.providerTransactionId || txn,
      Number(result.amount) > 0 ? Number(result.amount) : d.amount,
    );
  }

  if (result.status === 'REVIEW_REQUIRED') {
    d.status = 'REVIEW_REQUIRED';
    d.failureReason = result.message;
    await rememberDeposit(d);
    return {
      ok: false as const,
      status: 'REVIEW_REQUIRED' as const,
      message: result.message,
      deposit: d,
    };
  }

  d.status = 'FAILED';
  d.failureReason = result.message;
  await rememberDeposit(d);
  return {
    ok: false as const,
    status: 'FAILED' as const,
    message: result.message,
    deposit: d,
  };
}

export async function creditFromWebhook(input: {
  depositId?: string;
  merchantOrderId?: string;
  transactionNumber?: string;
  amount?: number;
  providerTransactionId?: string;
  /** Accepted for callers; only ETB is credited */
  currency?: string;
}) {
  let d: Deposit | null = null;
  if (input.depositId) d = await findDeposit(input.depositId);

  if (!d && input.merchantOrderId) {
    const orderId = input.merchantOrderId.trim();
    if (orderId) {
      const all = await listDepositsAsync();
      d =
        all.find(
          (x) =>
            x.merchantOrderId === orderId ||
            x.id === orderId,
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
  const amt =
    input.amount && input.amount > 0 ? input.amount : d.amount;
  return creditConfirmed(d, txn, amt);
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
      message: 'This transaction was already claimed.',
    };
  }

  const result = await verifyTelebirrWithVerifyEt({
    transactionNumber: txn,
    expectedAmount: Number(input.amount) || 0,
  });

  if (result.verified && result.status === 'CONFIRMED') {
    const amount =
      Number(result.amount) > 0
        ? Number(result.amount)
        : Number(input.amount) > 0
          ? Number(input.amount)
          : 0;
    if (!(amount > 0)) {
      return {
        ok: false as const,
        status: 'REVIEW_REQUIRED' as const,
        message: 'Verified but amount missing — create a deposit order first.',
        amount,
      };
    }
    const id = randomUUID();
    const merchantOrderId =
      `EQ${Date.now().toString(36)}${id.slice(0, 6)}`.toUpperCase();
    const deposit: Deposit = {
      id,
      userId: input.userId,
      amount,
      currency: 'ETB',
      status: 'PENDING',
      merchantOrderId,
      transactionNumber: txn,
      providerTransactionId: result.providerTransactionId || txn,
      checkoutUrl: null,
      failureReason: null,
      verificationAttempts: 1,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
      adminNote: null,
    };
    await rememberDeposit(deposit);
    const credited = await creditConfirmed(
      deposit,
      result.providerTransactionId || txn,
      amount,
    );
    return {
      ok: credited.ok,
      status: credited.status,
      message: credited.message,
      amount,
      balance: credited.balance,
      deposit: credited.deposit,
    };
  }

  const claimedAmount = Number(input.amount);
  const amount =
    Number.isFinite(claimedAmount) && claimedAmount > 0
      ? Math.round(claimedAmount * 100) / 100
      : Number.isFinite(Number(result.amount)) && Number(result.amount) > 0
        ? Math.round(Number(result.amount) * 100) / 100
        : 0;

  if (!(amount > 0)) {
    return {
      ok: false as const,
      status: 'REVIEW_REQUIRED' as const,
      message:
        'Verify.ET is offline. Create a deposit order with amount first, or wait for admin after pasting your txn on an order.',
    };
  }

  const id = randomUUID();
  const merchantOrderId =
    `EQ${Date.now().toString(36)}${id.slice(0, 6)}`.toUpperCase();
  const deposit: Deposit = {
    id,
    userId: input.userId,
    amount,
    currency: 'ETB',
    status: 'REVIEW_REQUIRED',
    merchantOrderId,
    transactionNumber: txn,
    providerTransactionId: null,
    checkoutUrl: null,
    failureReason:
      result.status === 'UNAVAILABLE'
        ? 'VERIFY_ET_API_KEY not set — admin must approve'
        : result.message || 'Awaiting admin review',
    verificationAttempts: 1,
    createdAt: new Date().toISOString(),
    confirmedAt: null,
    adminNote: null,
  };
  await rememberDeposit(deposit);

  return {
    ok: false as const,
    status: 'REVIEW_REQUIRED' as const,
    message:
      'Submitted for admin approval. Balance updates after an admin confirms your Telebirr payment.',
    amount,
    deposit,
  };
}

export { publicWalletConfig };
