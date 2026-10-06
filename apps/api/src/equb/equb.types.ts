export type EqubRoomStatus = 'open' | 'drawing' | 'completed';

export type EqubMember = {
  playerId: string;
  name: string;
  pick: number;
  joinedAt: number;
};

export type EqubRoom = {
  id: string;
  templateId: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier: string;
  status: EqubRoomStatus;
  members: EqubMember[];
  winningNumber: number | null;
  /** Exactly one winner per completed game */
  winnerId: string | null;
  winnerName?: string | null;
  /** Platform fee (15%) and winner payout (85%) */
  adminFee?: number | null;
  winnerPayout?: number | null;
  entropyHex: string | null;
  commitmentHash: string | null;
  drawAt: number;
  secondsLeft: number;
  createdAt: number;
  updatedAt: number;
};

export const ADMIN_FEE_RATE = 0.15;

export function splitPot(prizePool: number) {
  const gross = Math.round(Number(prizePool) * 100) / 100;
  const adminFee = Math.round(gross * ADMIN_FEE_RATE * 100) / 100;
  const winnerPayout = Math.round((gross - adminFee) * 100) / 100;
  return { grossPot: gross, adminFee, winnerPayout };
}

export function roomTemplateId(groupSize: number, prizePool: number) {
  return `equb-${groupSize}-${prizePool}`;
}

export function contributionOf(prizePool: number, groupSize: number) {
  return Math.round((prizePool / groupSize) * 100) / 100;
}

export const GROUP_SIZES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

/** Round length: random winner every 60 seconds */
export const ROUND_MS = 60_000;

export function buildCatalog(maxPrize = 9000) {
  const pools: number[] = [500];
  for (let p = 1000; p <= 9000; p += 1000) pools.push(p);
  for (let p = 10000; p <= 90000; p += 10000) pools.push(p);
  const out: Array<{
    id: string;
    groupSize: number;
    prizePool: number;
    contribution: number;
    tier: string;
  }> = [];
  for (const size of GROUP_SIZES) {
    for (const prize of pools) {
      if (prize > maxPrize) continue;
      const tier = prize <= 500 ? 'entry' : prize < 10000 ? 'low' : 'mid';
      out.push({
        id: roomTemplateId(size, prize),
        groupSize: size,
        prizePool: prize,
        contribution: contributionOf(prize, size),
        tier,
      });
    }
  }
  return out;
}
