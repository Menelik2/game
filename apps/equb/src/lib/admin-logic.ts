/**
 * Admin algorithms — Equb platform economics & KPIs
 *
 * RULES
 * ─────
 * 1. Every completed game pot is split:
 *      adminFee   = round(grossPot × ADMIN_FEE_RATE, 2)   // 15%
 *      winnerPay  = grossPot − adminFee                   // 85%
 * 2. Admin never takes from empty/cancelled rooms.
 * 3. Totals are sum of per-game fees (not recomputed from average).
 * 4. Average fee = totalFees / gamesWithFee (0 if none).
 */

import { ADMIN_FEE_RATE, WINNER_SHARE_RATE, splitPot } from './equb-math';

export { ADMIN_FEE_RATE, WINNER_SHARE_RATE, splitPot };

export type FeeRow = {
  roomId: string;
  winnerName: string;
  grossPot: number;
  winnerPayout: number;
  adminFee: number;
  at: number;
};

export type FeeSummary = {
  /** Σ adminFee */
  totalAdminFees: number;
  /** Σ grossPot */
  totalGrossPots: number;
  /** Σ winnerPayout */
  totalWinnerPayouts: number;
  /** Number of fee-bearing games */
  gamesCount: number;
  /** totalAdminFees / gamesCount */
  avgFeePerGame: number;
  /** ADMIN_FEE_RATE × 100 */
  feePercent: number;
  rows: FeeRow[];
};

/** Build fee rows from adminFeeLog (preferred) or history fallback */
export function buildFeeRows(
  adminFeeLog: Array<{
    roomId: string;
    winnerName: string;
    grossPot: number;
    winnerPayout: number;
    adminFee: number;
    at: number;
  }> | null | undefined,
  history: Array<{
    roomId: string;
    winnerName: string;
    amount: number;
    winnerPayout?: number;
    adminFee?: number;
    at: number;
  }> | null | undefined,
): FeeRow[] {
  if (adminFeeLog?.length) {
    return adminFeeLog.map((e) => {
      const gross = num(e.grossPot);
      // Re-validate split so display always matches algorithm
      const split = splitPot(gross);
      return {
        roomId: e.roomId,
        winnerName: e.winnerName || '—',
        grossPot: split.grossPot,
        winnerPayout: num(e.winnerPayout) || split.winnerPayout,
        adminFee: num(e.adminFee) || split.adminFee,
        at: e.at || Date.now(),
      };
    });
  }

  return (history || [])
    .filter((h) => h && (typeof h.adminFee === 'number' || typeof h.amount === 'number'))
    .map((h) => {
      const gross = num(h.amount);
      const split = splitPot(gross);
      return {
        roomId: h.roomId,
        winnerName: h.winnerName || '—',
        grossPot: split.grossPot,
        winnerPayout: num(h.winnerPayout) || split.winnerPayout,
        adminFee: num(h.adminFee) || split.adminFee,
        at: h.at || Date.now(),
      };
    });
}

/** Aggregate fee KPIs from rows + optional stored running total */
export function summarizeFees(
  rows: FeeRow[],
  storedTotal?: number | null,
): FeeSummary {
  const totalFromRows = round2(rows.reduce((s, r) => s + r.adminFee, 0));
  const totalGross = round2(rows.reduce((s, r) => s + r.grossPot, 0));
  const totalWinner = round2(rows.reduce((s, r) => s + r.winnerPayout, 0));
  const games = rows.length;
  // Prefer explicit running total when it matches or exceeds row sum (newer sessions)
  const stored = num(storedTotal);
  const totalAdminFees = stored > 0 ? Math.max(stored, totalFromRows) : totalFromRows;

  return {
    totalAdminFees,
    totalGrossPots: totalGross,
    totalWinnerPayouts: totalWinner,
    gamesCount: games,
    avgFeePerGame: games ? round2(totalAdminFees / games) : 0,
    feePercent: Math.round(ADMIN_FEE_RATE * 100),
    rows,
  };
}

/** Verify a pot split is consistent (used in tests / audit) */
export function assertSplit(grossPot: number, adminFee: number, winnerPayout: number): boolean {
  const s = splitPot(grossPot);
  return (
    Math.abs(s.adminFee - adminFee) < 0.02 &&
    Math.abs(s.winnerPayout - winnerPayout) < 0.02 &&
    Math.abs(adminFee + winnerPayout - grossPot) < 0.02
  );
}

/** Room occupancy KPIs */
export function roomStats(
  rooms: Array<{ status: string; members?: unknown[]; groupSize?: number }>,
) {
  const open = rooms.filter((r) => r.status === 'open').length;
  const drawing = rooms.filter((r) => r.status === 'drawing').length;
  const completed = rooms.filter((r) => r.status === 'completed').length;
  const seatsFilled = rooms.reduce((s, r) => s + (r.members?.length || 0), 0);
  return { open, drawing, completed, total: rooms.length, seatsFilled };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
