/**
 * Server-side wallet settlement for Equb bets and wins.
 * Balance lives in app_users (Supabase) or in-memory fallback.
 */
import { dbAdjustBalance, dbGetUser, isDbConfigured } from './db-users';
import { applyDelta, ensureWallet } from './wallets';

const ADMIN_FEE_RATE = 0.15;

const g = globalThis as unknown as {
  __paidKeys?: Set<string>;
  __feeKeys?: Set<string>;
};
if (!g.__paidKeys) g.__paidKeys = new Set();
if (!g.__feeKeys) g.__feeKeys = new Set();

export function computePayout(prizePool: number) {
  const gross = Math.round(Number(prizePool) * 100) / 100;
  const adminFee = Math.round(gross * ADMIN_FEE_RATE * 100) / 100;
  const winnerPayout = Math.round((gross - adminFee) * 100) / 100;
  return { gross, adminFee, winnerPayout };
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}

export async function readBalance(userId: string): Promise<number | null> {
  if (!userId) return null;
  if (isUuid(userId)) {
    try {
      const u = await dbGetUser(userId);
      if (u) return Number(u.balance);
    } catch {
      /* */
    }
  }
  try {
    return ensureWallet(userId).balance;
  } catch {
    return null;
  }
}

/** Debit join fee. Idempotent per room+user+picks. Throws if insufficient funds. */
export async function settleJoinFee(input: {
  userId: string;
  amount: number;
  roomId: string;
  picks: number[];
}): Promise<{ balance: number; debited: boolean }> {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!(amount > 0)) {
    return { balance: (await readBalance(input.userId)) ?? 0, debited: false };
  }

  const feeKey = `fee:${input.userId}:${input.roomId}:${[...input.picks].sort((a, b) => a - b).join(',')}`;
  if (g.__feeKeys!.has(feeKey)) {
    return { balance: (await readBalance(input.userId)) ?? 0, debited: false };
  }

  if (isUuid(input.userId)) {
    try {
      // Prefer DB when configured
      if (isDbConfigured() || true) {
        const r = await dbAdjustBalance(
          input.userId,
          -amount,
          `join_fee:${input.roomId}`,
        );
        g.__feeKeys!.add(feeKey);
        try {
          applyDelta(input.userId, -amount, 'join_fee');
        } catch {
          /* mirror optional */
        }
        return { balance: r.balance, debited: true };
      }
    } catch (e: any) {
      throw new Error(e?.message || 'Insufficient balance');
    }
  }

  // Non-UUID / guest wallet
  const w = ensureWallet(input.userId);
  if (w.balance < amount) {
    throw new Error(`Insufficient balance: need ${amount}, have ${w.balance}`);
  }
  const next = applyDelta(input.userId, -amount, 'join_fee');
  g.__feeKeys!.add(feeKey);
  return { balance: next.balance, debited: true };
}

/** Credit winner. Idempotent per room+user+number. */
export async function settleWinPayout(input: {
  userId: string;
  amount: number;
  roomId: string;
  winningNumber: number;
}): Promise<{ balance: number; credited: boolean }> {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!(amount > 0) || !input.userId) {
    return { balance: (await readBalance(input.userId)) ?? 0, credited: false };
  }

  const payKey = `win:${input.userId}:${input.roomId}:#${input.winningNumber}`;
  if (g.__paidKeys!.has(payKey)) {
    return { balance: (await readBalance(input.userId)) ?? 0, credited: false };
  }

  if (isUuid(input.userId)) {
    try {
      const r = await dbAdjustBalance(
        input.userId,
        amount,
        `win:${input.roomId}:#${input.winningNumber}`,
      );
      g.__paidKeys!.add(payKey);
      try {
        applyDelta(input.userId, amount, 'prize_win');
      } catch {
        /* */
      }
      return { balance: r.balance, credited: true };
    } catch (e: any) {
      throw new Error(e?.message || 'Credit failed');
    }
  }

  const next = applyDelta(input.userId, amount, 'prize_win');
  g.__paidKeys!.add(payKey);
  return { balance: next.balance, credited: true };
}

/** Refund a failed join (idempotent inverse of fee key). */
export async function refundJoinFee(input: {
  userId: string;
  amount: number;
  roomId: string;
  picks: number[];
}): Promise<void> {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!(amount > 0)) return;
  const feeKey = `fee:${input.userId}:${input.roomId}:${[...input.picks].sort((a, b) => a - b).join(',')}`;
  if (!g.__feeKeys!.has(feeKey)) return;
  try {
    await settleWinPayout({
      userId: input.userId,
      amount,
      roomId: `refund-${input.roomId}`,
      winningNumber: 0,
    });
  } finally {
    g.__feeKeys!.delete(feeKey);
  }
}
