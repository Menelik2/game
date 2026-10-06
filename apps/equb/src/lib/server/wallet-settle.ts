/**
 * Server-side wallet settlement for Equb bets and wins.
 * Uses app_users (Supabase / memory) so balance persists across deploys.
 */
import { dbAdjustBalance, dbGetUser, isDbConfigured } from './db-users';
import { applyDelta, ensureWallet } from './wallets';

const ADMIN_FEE_RATE = 0.15;

export function computePayout(prizePool: number) {
  const gross = Math.round(Number(prizePool) * 100) / 100;
  const adminFee = Math.round(gross * ADMIN_FEE_RATE * 100) / 100;
  const winnerPayout = Math.round((gross - adminFee) * 100) / 100;
  return { gross, adminFee, winnerPayout };
}

/** Debit join fee. Returns new balance or throws. */
export async function settleJoinFee(input: {
  userId: string;
  amount: number;
  roomId: string;
  picks: number[];
}): Promise<{ balance: number }> {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  if (!(amount > 0)) return { balance: (await readBalance(input.userId)) ?? 0 };

  // Prefer DB user balance (UUID accounts)
  if (isUuid(input.userId)) {
    try {
      const r = await dbAdjustBalance(
        input.userId,
        -amount,
        `join_fee:${input.roomId}:${input.picks.join(',')}`,
      );
      // Mirror in-memory wallet for SSE listeners
      try {
        applyDelta(input.userId, -amount, 'join_fee');
      } catch {
        /* */
      }
      return { balance: r.balance };
    } catch (e: any) {
      throw new Error(e?.message || 'Insufficient balance');
    }
  }

  const w = ensureWallet(input.userId);
  if (w.balance < amount) {
    throw new Error(`Insufficient balance: need ${amount}, have ${w.balance}`);
  }
  const next = applyDelta(input.userId, -amount, 'join_fee');
  return { balance: next.balance };
}

/** Credit winner once. Idempotent via paidKey stored by caller. */
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

  if (isUuid(input.userId)) {
    try {
      const r = await dbAdjustBalance(
        input.userId,
        amount,
        `win:${input.roomId}:#${input.winningNumber}`,
      );
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
  return { balance: next.balance, credited: true };
}

export async function readBalance(userId: string): Promise<number | null> {
  if (!userId) return null;
  if (isUuid(userId)) {
    const u = await dbGetUser(userId);
    if (u) return u.balance;
  }
  try {
    return ensureWallet(userId).balance;
  } catch {
    return null;
  }
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  );
}
