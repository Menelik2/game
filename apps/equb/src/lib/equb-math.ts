/** Fast Equb: pick numbers → computer draws → one winner */

/** Group sizes: multiples of 5 (5, 10, 15, … 100) */
export const GROUP_SIZES = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
] as const;
export type GroupSize = (typeof GROUP_SIZES)[number];

/**
 * Number Selection Rule:
 * Max numbers a player may choose = Group Size ÷ 5
 * 5→1, 10→2, 15→3, 20→4, 25→5, …
 */
export function maxPicksForGroup(groupSize: number): number {
  const n = Math.floor(Number(groupSize) / 5);
  return Math.max(1, n);
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
  for (let p = 100000; p <= 1000000; p += 100000) pools.push(p);
  return pools;
}

export const PRIZE_POOLS = buildPrizePools();

export function contributionPerMember(prizePool: number, groupSize: number): number {
  if (groupSize <= 0) throw new Error('Invalid group size');
  return Math.round((prizePool / groupSize) * 100) / 100;
}

export function roomId(groupSize: number, prizePool: number): string {
  return `equb-${groupSize}-${prizePool}`;
}

export type RoomTemplate = {
  id: string;
  groupSize: GroupSize | number;
  prizePool: number;
  contribution: number;
  tier: 'entry' | 'low' | 'mid' | 'high';
  label: string;
};

export function tierFor(prize: number): RoomTemplate['tier'] {
  if (prize <= 500) return 'entry';
  if (prize < 10000) return 'low';
  if (prize < 100000) return 'mid';
  return 'high';
}

export function buildRoomCatalog(opts?: { maxPrize?: number }): RoomTemplate[] {
  const max = opts?.maxPrize ?? 9000;
  const out: RoomTemplate[] = [];
  for (const size of GROUP_SIZES) {
    for (const prize of PRIZE_POOLS) {
      if (prize > max) continue;
      const contribution = contributionPerMember(prize, size);
      out.push({
        id: roomId(size, prize),
        groupSize: size,
        prizePool: prize,
        contribution,
        tier: tierFor(prize),
        label: `${size} players · ${prize.toLocaleString()} Birr pot · ${contribution} each`,
      });
    }
  }
  return out;
}

export type EqubMember = {
  id: string;
  name: string;
  /** Primary pick (first selected) — kept for compatibility */
  pick: number;
  /** All numbers this player holds (length ≤ maxPicksForGroup) */
  picks?: number[];
  isBot?: boolean;
};

export type LiveRoom = {
  id: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier: string;
  status: 'open' | 'drawing' | 'completed';
  members: EqubMember[];
  winningNumber: number | null;
  winnerId: string | null;
  winnerName?: string | null;
  lastAdminFee?: number;
  lastWinnerPayout?: number;
  entropyHex?: string;
  commitmentHash?: string;
};

/** Normalize member picks array */
export function memberPicks(m: EqubMember): number[] {
  if (m.picks && m.picks.length > 0) return [...m.picks];
  return [m.pick];
}

/** How many seats are taken (sum of all picks) */
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
  for (const m of r.members) {
    for (const p of memberPicks(m)) s.add(p);
  }
  return s;
}

export function numberPool(groupSize: number) {
  return Array.from({ length: groupSize }, (_, i) => i + 1);
}

/** Validate a player's selection against the rule */
export function validatePicks(
  groupSize: number,
  picks: number[],
  alreadyTaken: Set<number>,
): { ok: true; picks: number[] } | { ok: false; message: string } {
  const max = maxPicksForGroup(groupSize);
  const unique = [...new Set(picks.map((n) => Math.floor(Number(n))))].filter(
    (n) => n >= 1 && n <= groupSize,
  );
  if (unique.length === 0) {
    return { ok: false, message: `Pick 1–${max} number(s)` };
  }
  if (unique.length > max) {
    return {
      ok: false,
      message: `Max ${max} number(s) for ${groupSize}-player room (size ÷ 5)`,
    };
  }
  for (const p of unique) {
    if (alreadyTaken.has(p)) {
      return { ok: false, message: `Number ${p} is taken` };
    }
  }
  return { ok: true, picks: unique.sort((a, b) => a - b) };
}
