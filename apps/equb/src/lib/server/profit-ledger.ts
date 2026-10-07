/**
 * Platform profit ledger — one row per completed game with real seats.
 * Source of truth for admin Profit Analytics (not mock data).
 */

import { splitPotWithRate, getPlatformFeeRate } from './prize-settings';

export type ProfitGameRow = {
  id: string;
  roomId: string;
  templateId: string;
  groupSize: number;
  grossPot: number;
  adminFee: number;
  winnerPayout: number;
  feeRate: number;
  winnerId: string | null;
  winnerName: string | null;
  winningNumber: number | null;
  seatsTaken: number;
  completedAt: string; // ISO
  completedAtMs: number;
};

export type ProfitPeriodSummary = {
  profit: number;
  games: number;
  grossPot: number;
  winnerPayout: number;
};

export type ProfitAnalytics = {
  feeRate: number;
  feePercent: number;
  perGame: ProfitGameRow[];
  daily: ProfitPeriodSummary;
  weekly: ProfitPeriodSummary;
  monthly: ProfitPeriodSummary;
  total: ProfitPeriodSummary;
  byTemplate: Array<{ templateId: string; profit: number; games: number }>;
};

const MAX_ROWS = 2000;
const g = globalThis as unknown as { __profitLedger?: ProfitGameRow[] };
if (!g.__profitLedger) g.__profitLedger = [];

function round2(n: number) {
  return Math.round(Number(n) * 100) / 100;
}

function startOfUtcDay(d = new Date()) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function startOfUtcMonth(d = new Date()) {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function sumRows(rows: ProfitGameRow[]): ProfitPeriodSummary {
  return {
    profit: round2(rows.reduce((s, r) => s + r.adminFee, 0)),
    games: rows.length,
    grossPot: round2(rows.reduce((s, r) => s + r.grossPot, 0)),
    winnerPayout: round2(rows.reduce((s, r) => s + r.winnerPayout, 0)),
  };
}

/** Idempotent: same roomId only recorded once. */
export function recordGameProfit(input: {
  roomId: string;
  templateId: string;
  groupSize: number;
  prizePool: number;
  adminFee?: number | null;
  winnerPayout?: number | null;
  feeRate?: number | null;
  winnerId?: string | null;
  winnerName?: string | null;
  winningNumber?: number | null;
  seatsTaken?: number;
  completedAtMs?: number;
}): ProfitGameRow | null {
  const ledger = g.__profitLedger!;
  if (ledger.some((r) => r.roomId === input.roomId)) return null;

  const rate = Number.isFinite(Number(input.feeRate))
    ? Number(input.feeRate)
    : getPlatformFeeRate();
  const split = splitPotWithRate(input.prizePool, rate);
  const adminFee =
    typeof input.adminFee === 'number' && input.adminFee >= 0
      ? round2(input.adminFee)
      : split.adminFee;
  const winnerPayout =
    typeof input.winnerPayout === 'number' && input.winnerPayout >= 0
      ? round2(input.winnerPayout)
      : split.winnerPayout;

  // No profit from empty / zero-pot rounds
  if (!(adminFee > 0) && !(input.prizePool > 0)) return null;
  if ((input.seatsTaken ?? 0) < 1) return null;

  const at = input.completedAtMs || Date.now();
  const row: ProfitGameRow = {
    id: `pf_${at.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    roomId: input.roomId,
    templateId: input.templateId,
    groupSize: input.groupSize,
    grossPot: split.grossPot,
    adminFee,
    winnerPayout,
    feeRate: split.adminFeeRate,
    winnerId: input.winnerId ?? null,
    winnerName: input.winnerName ?? null,
    winningNumber: input.winningNumber ?? null,
    seatsTaken: input.seatsTaken ?? 0,
    completedAt: new Date(at).toISOString(),
    completedAtMs: at,
  };
  ledger.unshift(row);
  if (ledger.length > MAX_ROWS) ledger.length = MAX_ROWS;
  return row;
}

export function listProfitGames(limit = 100): ProfitGameRow[] {
  return g.__profitLedger!.slice(0, Math.min(500, Math.max(1, limit)));
}

export function getProfitAnalytics(opts?: { limit?: number }): ProfitAnalytics {
  const all = g.__profitLedger!;
  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const weekStart = dayStart - 6 * 24 * 60 * 60 * 1000;
  const monthStart = startOfUtcMonth(now);

  const dailyRows = all.filter((r) => r.completedAtMs >= dayStart);
  const weeklyRows = all.filter((r) => r.completedAtMs >= weekStart);
  const monthlyRows = all.filter((r) => r.completedAtMs >= monthStart);

  const byMap = new Map<string, { profit: number; games: number }>();
  for (const r of all) {
    const cur = byMap.get(r.templateId) || { profit: 0, games: 0 };
    cur.profit = round2(cur.profit + r.adminFee);
    cur.games += 1;
    byMap.set(r.templateId, cur);
  }
  const byTemplate = [...byMap.entries()]
    .map(([templateId, v]) => ({ templateId, ...v }))
    .sort((a, b) => b.profit - a.profit);

  const feeRate = getPlatformFeeRate();
  return {
    feeRate,
    feePercent: Math.round(feeRate * 10000) / 100,
    perGame: listProfitGames(opts?.limit ?? 50),
    daily: sumRows(dailyRows),
    weekly: sumRows(weeklyRows),
    monthly: sumRows(monthlyRows),
    total: sumRows(all),
    byTemplate,
  };
}
