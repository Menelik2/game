/** Fast Equb: pick numbers → computer draws → one winner */

/** Group sizes: multiples of 5 (5, 10, 15, … 100) */
export const GROUP_SIZES = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
] as const;
export type GroupSize = (typeof GROUP_SIZES)[number];

/**
 * Number Selection Rule:
 * 5-player room  → max 1 number
 * 10+ players    → max 2 numbers
 * (15, 20, 25, 30, 35, 40, 45, 50, … all capped at 2)
 */
export function maxPicksForGroup(groupSize: number): number {
  const size = Math.floor(Number(groupSize) || 0);
  if (size <= 5) return 1;
  return 2;
}

/** Platform / admin share of each pot when a game completes */
export const ADMIN_FEE_RATE = 0.15;
export const WINNER_SHARE_RATE = 1 - ADMIN_FEE_RATE; // 0.85

export function splitPot(prizePool: number): {
  grossPot: number;
  adminFee: number;
  winnerPayout: number;
  adminFeeRate: number;
} {
  const gross = Math.round(Number(prizePool) * 100) / 100;
  const adminFee = Math.round(gross * ADMIN_FEE_RATE * 100) / 100;
  const winnerPayout = Math.round((gross - adminFee) * 100) / 100;
  return {
    grossPot: gross,
    adminFee,
    winnerPayout,
    adminFeeRate: ADMIN_FEE_RATE,
  };
}

export function buildPrizePools(): number[] {
  const pools: number[] = [500];
  for (let p = 1000; p <= 9000; p += 1000) pools.push(p);
  for (let p = 10000; p <= 90000; p += 10000) pools.push(p);
  return pools;
}

export function contributionPerSeat(prizePool: number, groupSize: number): number {
  return Math.round((Number(prizePool) / Number(groupSize)) * 100) / 100;
}

export function seatsTaken(
  members: Array<{ picks?: number[]; pick?: number }>,
): number {
  return members.reduce((n, m) => {
    if (m.picks && m.picks.length) return n + m.picks.length;
    if (m.pick != null) return n + 1;
    return n;
  }, 0);
}

export function isFull(room: {
  groupSize: number;
  members: Array<{ picks?: number[]; pick?: number }>;
}): boolean {
  return seatsTaken(room.members) >= room.groupSize;
}

export function validatePicks(
  groupSize: number,
  picks: number[],
): { ok: true } | { ok: false; message: string } {
  const max = maxPicksForGroup(groupSize);
  const clean = [...new Set(picks.map((n) => Math.floor(Number(n))))].filter(
    (n) => n >= 1 && n <= groupSize,
  );
  if (clean.length === 0) {
    return { ok: false, message: `Pick 1–${max} number(s)` };
  }
  if (clean.length > max) {
    return {
      ok: false,
      message:
        groupSize <= 5
          ? `Max 1 number for 5-player room`
          : `Max 2 numbers for ${groupSize}-player room`,
    };
  }
  return { ok: true };
}
