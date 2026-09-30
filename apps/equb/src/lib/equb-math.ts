/** Fast Equb draw: players pick numbers → CSPRNG draws → one winner */

export const GROUP_SIZES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export type GroupSize = (typeof GROUP_SIZES)[number];

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

export function numberPool(groupSize: number): number[] {
  return Array.from({ length: groupSize }, (_, i) => i + 1);
}

export type EqubMember = {
  id: string;
  name: string;
  pick: number | null;
  isBot?: boolean;
};

export type LiveRoom = RoomTemplate & {
  members: EqubMember[];
  status: 'open' | 'drawing' | 'completed';
  winningNumber: number | null;
  winnerId: string | null;
  createdAt: number;
};

export function seatsLeft(room: LiveRoom): number {
  return Math.max(0, room.groupSize - room.members.length);
}

export function isFull(room: LiveRoom): boolean {
  return room.members.length >= room.groupSize;
}

export function takenPicks(room: LiveRoom): Set<number> {
  return new Set(room.members.filter((m) => m.pick != null).map((m) => m.pick as number));
}

/** Use cryptographicDraw from ./crypto-rng for draws. */
