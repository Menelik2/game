/** Fast Equb: pick numbers → computer draws → one winner */

/** Group sizes: multiples of 5 (5, 10, 15, … 100) */
export const GROUP_SIZES = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
] as const;
export type GroupSize = (typeof GROUP_SIZES)[number];

/**
 * Number Selection Rule:
 * 5-player room  → max 1 number
 * 10+ players    → max 2 numbers (15, 20, 25, … 50 all max 2)
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

export const PRIZE_POOLS = buildPrizePools();

export function contributionPerMember(prizePool: number, groupSize: number): number {
  return Math.round((Number(prizePool) / Number(groupSize)) * 100) / 100;
}

export function roomId(groupSize: number, prizePool: number): string {
  return `equb-${groupSize}-${prizePool}`;
}

export type RoomTemplate = {
  id: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier: 'entry' | 'low' | 'mid' | 'high' | 'vip';
};

export function tierFor(prize: number): RoomTemplate['tier'] {
  if (prize <= 500) return 'entry';
  if (prize < 5000) return 'low';
  if (prize < 20000) return 'mid';
  if (prize < 50000) return 'high';
  return 'vip';
}

export function buildRoomCatalog(opts?: { maxPrize?: number }): RoomTemplate[] {
  const maxPrize = opts?.maxPrize ?? 90000;
  const out: RoomTemplate[] = [];
  for (const size of GROUP_SIZES) {
    for (const prize of PRIZE_POOLS) {
      if (prize > maxPrize) continue;
      out.push({
        id: roomId(size, prize),
        groupSize: size,
        prizePool: prize,
        contribution: contributionPerMember(prize, size),
        tier: tierFor(prize),
      });
    }
  }
  return out;
}

export type EqubMember = {
  id: string;
  name: string;
  pick: number;
  picks?: number[];
  isBot?: boolean;
  joinedAt: number;
};

export type LiveRoom = {
  id: string;
  templateId?: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier?: string;
  status: 'open' | 'drawing' | 'completed';
  members: EqubMember[];
  winningNumber?: number | null;
  winnerId?: string | null;
  winnerName?: string | null;
  adminFee?: number | null;
  winnerPayout?: number | null;
  drawAt?: number;
  secondsLeft?: number;
};

export function memberPicks(m: EqubMember): number[] {
  if (m.picks && m.picks.length) return m.picks;
  return [m.pick];
}

export function seatsTaken(r: LiveRoom): number {
  return r.members.reduce((n, m) => n + memberPicks(m).length, 0);
}

export function seatsLeft(r: LiveRoom) {
  return Math.max(0, r.groupSize - seatsTaken(r));
}

export function isFull(r: LiveRoom) {
  return seatsTaken(r) >= r.groupSize;
}

export function takenPicks(r: LiveRoom) {
  const s = new Set<number>();
  for (const m of r.members) for (const p of memberPicks(m)) s.add(p);
  return s;
}

export function numberPool(groupSize: number) {
  return Array.from({ length: groupSize }, (_, i) => i + 1);
}

export function validatePicks(
  groupSize: number,
  picks: number[],
): { ok: true; picks: number[] } | { ok: false; message: string } {
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
  return { ok: true, picks: clean };
}
