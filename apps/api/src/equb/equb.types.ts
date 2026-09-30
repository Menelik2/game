export type EqubRoomStatus = 'open' | 'completed';

export type EqubMember = {
  playerId: string;
  name: string;
  pick: number;
  joinedAt: number;
};

export type EqubRoom = {
  id: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier: string;
  status: EqubRoomStatus;
  members: EqubMember[];
  winningNumber: number | null;
  winnerId: string | null;
  entropyHex: string | null;
  commitmentHash: string | null;
  createdAt: number;
  updatedAt: number;
};

export function contributionOf(prizePool: number, groupSize: number) {
  return Math.round((prizePool / groupSize) * 100) / 100;
}

export const GROUP_SIZES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function buildCatalog(maxPrize = 9000) {
  const pools: number[] = [500];
  for (let p = 1000; p <= 9000; p += 1000) pools.push(p);
  for (let p = 10000; p <= 90000; p += 10000) pools.push(p);
  const out: Array<{ id: string; groupSize: number; prizePool: number; contribution: number; tier: string }> = [];
  for (const size of GROUP_SIZES) {
    for (const prize of pools) {
      if (prize > maxPrize) continue;
      const tier = prize <= 500 ? 'entry' : prize < 10000 ? 'low' : 'mid';
      out.push({
        id: `equb-${size}-${prize}`,
        groupSize: size,
        prizePool: prize,
        contribution: contributionOf(prize, size),
        tier,
      });
    }
  }
  return out;
}
