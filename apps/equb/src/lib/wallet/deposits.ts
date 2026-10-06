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

/** Resolve balance from DB user → shared wallets → deposit map */
export async function resolveBalance(userId: string): Promise<number> {
  try {
    if (isDbConfigured()) {
      const u = await dbGetUser(userId);
      if (u) return Math.max(0, Number(u.balance) || 0);
    }
  } catch {
    /* ignore */
  }
  try {
    const w = ensureWallet(userId);
    if (w && Number.isFinite(w.balance)) return Math.max(0, w.balance);
  } catch {
    /* ignore */
  }
  const local = g.__wallets!.get(userId);
  return local ? Math.max(0, local.balance) : 0;
}

export function walletOf(userId: string): Wallet {
  let w = g.__wallets!.get(userId);
  if (!w) {
    // Seed from shared wallets map if present
    let seed = 0;
    try {
      seed = ensureWallet(userId).balance;
    } catch {
      seed = 0;
    }
    w = { userId, balance: seed, withdrawable: seed };
    g.__wallets!.set(userId, w);
  }
  return w;
}

export async function walletOfAsync(userId: string): Promise<Wallet> {
  const bal = await resolveBalance(userId);
  const w = walletOf(userId);
  w.balance = bal;
  w.withdrawable = bal;
  return { ...w };
}

export function listDeposits(userId?: string): Deposit[] {
  const all = [...g.__dep!.values()];
  return (userId ? all.filter((d) => d.userId === userId) : all).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

function parseAmount(raw: unknown, min: number, max: number): number | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
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

  // 1) DB user balance (source of truth when Supabase configured)
  let after = Math.round((before + creditAmt) * 100) / 100;
  try {
    if (isDbConfigured()) {
      const r = await dbAdjustBalance(d.userId, creditAmt, 'deposit_telebirr');
      after = Number(r.balance);
    }
  } catch {
    // User may be local-only (non-UUID)
    after = Math.round((before + creditAmt) * 100) / 100;
  }

  // 2) Shared in-memory wallet (game /api/wallet)
  try {
    setBalance(d.userId, after);
  } catch {
    try {
      applyDelta(d.userId, creditAmt, 'deposit_telebirr');
    } catch {
      /* ignore */
    }
  }

  // 3) Deposit module map (history UI)
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

export async function verifyDeposit(input: {
  depositId: string;
  userId: string;
  transactionNumber: string;
}) {
  const d = g.__dep!.get(input.depositId);
  if (!d || d.userId !== input.userId) {
    return { ok: false, status: 'FAILED' as const, message: 'Deposit not found.' };
  }
  if (d.status === 'CONFIRMED') {
    const bal = await resolveBalance(d.userId);
    return {
      ok: false,
      status: 'CONFIRMED' as const,
      message: 'This deposit is already confirmed.',
      deposit: d,
      balance: bal,
    };
  }
  d.verificationAttempts += 1;
  if (d.verificationAttempts > 8) {
    d.status = 'REVIEW_REQUIRED';
    return {
      ok: false,
      status: 'REVIEW_REQUIRED' as const,
      message: 'Deposit under review.',
      deposit: d,
    };
  }
  const txn = input.transactionNumber.trim();
  if (txn.length < 6) {
    return {
      ok: false,
      status: 'FAILED' as const,
      message: 'Enter the Telebirr transaction number.',
    };
  }
  if (g.__usedTxn!.has(txn)) {
    d.status = 'REVIEW_REQUIRED';
    return {
      ok: false,
      status: 'REVIEW_REQUIRED' as const,
      message: 'This transaction has already been used.',
      deposit: d,
    };
  }

  const result = await verifyTelebirrWithVerifyEt({
    transactionNumber: txn,
    expectedAmount: d.amount,
  });
  d.transactionNumber = txn;

  if (!result.verified) {
    d.status =
      result.status === 'UNAVAILABLE'
        ? 'PROCESSING'
        : result.status === 'REVIEW_REQUIRED'
          ? 'REVIEW_REQUIRED'
          : result.status === 'FAILED'
            ? 'FAILED'
            : 'PROCESSING';
    d.failureReason = result.message;
    return { ok: false, status: d.status, message: result.message, deposit: d };
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

export { publicWalletConfig };
