/**
 * Server-side wallet settlement for Equb bets and wins.
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

async function adjust(userId: string, delta: number, reason: string) {
  if (isUuid(userId)) {
    const r = await dbAdjustBalance(userId, delta, reason);
    try {
      applyDelta(userId, delta, reason);
    } catch {
      /* optional mirror for SSE */
    }
    if (typeof r !== 'number' || !Number.isFinite(r)) {
      throw new Error('Balance update failed');
    }
    return r;
  }
  if (delta < 0) {
    const w = ensureWallet(userId);
    if (w.balance < Math.abs(delta)) {
      throw new Error(`Insufficient balance: need ${Math.abs(delta)}, have ${w.balance}`);
    }
  }
  return applyDelta(userId, delta, reason).balance;
}

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

  const feeKey = `fee:${input.userId}:${input.roomId}`;
  if (g.__feeKeys!.has(feeKey)) {
    return { balance: (await readBalance(input.userId)) ?? 0, debited: false };
  }

  try {
    const balance = await adjust(input.userId, -amount, `join_fee:${input.roomId}`);
    g.__feeKeys!.add(feeKey);
    return { balance, debited: true };
  } catch (e: unknown) {
    throw new Error(e instanceof Error ? e.message : 'Insufficient balance');
  }
}

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

  try {
    const balance = await adjust(
      input.userId,
      amount,
      `win:${input.roomId}:#${input.winningNumber}`,
    );
    g.__paidKeys!.add(payKey);
    return { balance, credited: true };
  } catch (e: unknown) {
    throw new Error(e instanceof Error ? e.message : 'Credit failed');
  }
}

export async function refundJoinFee(input: {
  userId: string;
  amount: number;
  roomId: string;
}): Promise<void> {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!(amount > 0)) return;
  const feeKey = `fee:${input.userId}:${input.roomId}`;
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

export function isDbUser(id: string) {
  return isUuid(id);
}
void isDbConfigured;
