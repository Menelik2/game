import { randomUUID } from 'crypto';
import { publicWalletConfig, verifyEtConfig } from '@/lib/verify-et/config';
import { verifyTelebirrWithVerifyEt } from '@/lib/verify-et/service';
import { dbAdjustBalance, dbGetUser, isDbConfigured } from '@/lib/server/db-users';
import { applyDelta, ensureWallet, setBalance } from '@/lib/server/wallets';

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
  g.__dep!.set(id, deposit);
  return { ok: true as const, deposit, checkoutUrl: null, config: publicWalletConfig() };
}

async function creditConfirmed(
  d: Deposit,
  providerTxn: string,
  amount: number,
) {
  if (g.__usedTxn!.has(providerTxn) || d.status === 'CONFIRMED') {
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

  return {
    ok: true as const,
    status: 'CONFIRMED' as const,
    message: 'Deposit confirmed — balance updated',
    deposit: d,
    balance: after,
    balanceBefore: before,
  };
}

/** Admin: manually confirm a pending/review deposit and credit wallet */
export async function adminConfirmDeposit(input: {
  depositId: string;
  transactionNumber?: string;
  note?: string;
}) {
  const d = g.__dep!.get(input.depositId);
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

/** Admin: reject a deposit */
export async function adminRejectDeposit(input: {
  depositId: string;
  reason?: string;
}) {
  const d = g.__dep!.get(input.depositId);
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
  return { ok: true as const, deposit: d };
}

export function listDeposits(userId?: string) {
  const all = [...g.__dep!.values()].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
  if (!userId) return all;
  return all.filter((d) => d.userId === userId);
}

export async function verifyDeposit(input: {
  depositId: string;
  userId: string;
  transactionNumber: string;
}) {
  const d = g.__dep!.get(input.depositId);
  if (!d || d.userId !== input.userId) {
    return { ok: false as const, status: 'FAILED' as const, message: 'Deposit not found' };
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
  d.verificationAttempts += 1;
  if (d.verificationAttempts > 8) {
    d.status = 'REVIEW_REQUIRED';
    return {
      ok: false as const,
      status: 'REVIEW_REQUIRED' as const,
      message: 'Deposit under review — admin will confirm.',
      deposit: d,
    };
  }
  const txn = input.transactionNumber.trim();
  if (txn.length < 6) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'Enter the Telebirr transaction number.',
    };
  }
  if (g.__usedTxn!.has(txn)) {
    d.status = 'REVIEW_REQUIRED';
    return {
      ok: false as const,
      status: 'REVIEW_REQUIRED' as const,
      message: 'This transaction has already been used.',
      deposit: d,
    };
  }

  d.transactionNumber = txn;

  const result = await verifyTelebirrWithVerifyEt({
    transactionNumber: txn,
    expectedAmount: d.amount,
  });

  if (!result.verified) {
    // Missing API key / unavailable → queue for admin approval
    if (result.status === 'UNAVAILABLE') {
      d.status = 'REVIEW_REQUIRED';
      d.failureReason =
        'Verify.ET not configured — waiting for admin approval.';
      return {
        ok: false as const,
        status: 'REVIEW_REQUIRED' as const,
        message:
          'Payment submitted for admin review. You will be credited after approval.',
        deposit: d,
      };
    }
    d.status =
      result.status === 'REVIEW_REQUIRED'
        ? 'REVIEW_REQUIRED'
        : result.status === 'FAILED'
          ? 'FAILED'
          : 'PROCESSING';
    d.failureReason = result.message;
    return { ok: false as const, status: d.status, message: result.message, deposit: d };
  }

  return creditConfirmed(
    d,
    result.providerTransactionId || txn,
    result.amount || d.amount,
  );
}

export async function creditFromWebhook(input: {
  merchantOrderId?: string;
  transactionNumber?: string;
  providerTransactionId: string;
  amount: number;
  currency: string;
}) {
  const d = [...g.__dep!.values()].find(
    (x) =>
      (input.merchantOrderId && x.merchantOrderId === input.merchantOrderId) ||
      (input.transactionNumber && x.transactionNumber === input.transactionNumber),
  );
  if (!d) return { ok: false, message: 'Unknown order' };
  if (d.status === 'CONFIRMED') return { ok: true, message: 'Already processed' };
  if (input.currency !== 'ETB') return { ok: false, message: 'Currency mismatch' };
  if (Math.round(input.amount * 100) !== Math.round(d.amount * 100)) {
    d.status = 'REVIEW_REQUIRED';
    d.failureReason = 'Amount mismatch';
    return { ok: false, message: 'Amount mismatch' };
  }
  if (g.__usedTxn!.has(input.providerTransactionId)) {
    return { ok: true, message: 'Duplicate transaction ignored' };
  }
  const credited = await creditConfirmed(d, input.providerTransactionId, input.amount);
  return { ok: credited.ok, message: credited.message, balance: credited.balance };
}

/**
 * User flow: paste Telebirr transaction number → verify or queue for admin.
 */
export async function claimByTransactionNumber(input: {
  userId: string;
  transactionNumber: string;
  /** Optional amount when Verify.ET is offline (admin still confirms) */
  amount?: number;
}) {
  const txn = String(input.transactionNumber || '').trim();
  if (!input.userId) {
    return { ok: false as const, status: 'FAILED' as const, message: 'Sign in first' };
  }
  if (txn.length < 6) {
    return {
      ok: false as const,
      status: 'FAILED' as const,
      message: 'Enter a valid Telebirr transaction number.',
    };
  }
  if (g.__usedTxn!.has(txn)) {
    const bal = await resolveBalance(input.userId);
    return {
      ok: false as const,
      status: 'CONFIRMED' as const,
      message: 'This transaction has already been used.',
      balance: bal,
    };
  }

  // Already queued for this user + txn?
  const existing = [...g.__dep!.values()].find(
    (d) =>
      d.userId === input.userId &&
      d.transactionNumber === txn &&
      d.status !== 'FAILED',
  );
  if (existing) {
    return {
      ok: false as const,
      status: existing.status,
      message:
        existing.status === 'CONFIRMED'
          ? 'Already confirmed'
          : 'Already submitted — waiting for admin approval.',
      deposit: existing,
      amount: existing.amount,
    };
  }

  const result = await verifyTelebirrWithVerifyEt({
    transactionNumber: txn,
    expectedAmount: 0,
  });

  const cfg = verifyEtConfig();

  // Auto path when Verify.ET works
  if (result.verified) {
    const amount = Number(result.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false as const,
        status: 'REVIEW_REQUIRED' as const,
        message:
          'Transaction verified but amount is missing. Contact admin with your transaction number.',
      };
    }
    if (amount < cfg.minDeposit || amount > cfg.maxDeposit) {
      return {
        ok: false as const,
        status: 'REVIEW_REQUIRED' as const,
        message: `Amount ${amount} ETB is outside allowed range (${cfg.minDeposit}–${cfg.maxDeposit}).`,
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
    g.__dep!.set(id, deposit);
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

  // Verify.ET missing / failed → queue for admin approval
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
  g.__dep!.set(id, deposit);

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
