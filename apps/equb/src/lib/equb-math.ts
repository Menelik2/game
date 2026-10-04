/** Fast Equb: pick numbers → computer draws → one winner */

export const GROUP_SIZES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export type GroupSize = (typeof GROUP_SIZES)[number];

/** Platform / admin share of each pot when a game completes */
export const ADMIN_FEE_RATE = 0.15;
export const WINNER_SHARE_RATE = 1 - ADMIN_FEE_RATE; // 0.85

/** Split pot: winner 85%, admin 15% */
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
  pick: number;
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
  /** Last draw split (set when completed) */
  lastAdminFee?: number;
  lastWinnerPayout?: number;
  entropyHex?: string;
  commitmentHash?: string;
};

export function seatsLeft(r: LiveRoom) {
  return Math.max(0, r.groupSize - r.members.length);
}

export function isFull(r: LiveRoom) {
  return r.members.length >= r.groupSize;
}

export function takenPicks(r: LiveRoom) {
  return new Set(r.members.map((m) => m.pick));
}

export function numberPool(groupSize: number) {
  return Array.from({ length: groupSize }, (_, i) => i + 1);
}
