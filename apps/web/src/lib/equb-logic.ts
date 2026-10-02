/** Pure Fast Equb helpers — client-side fair draw + catalog */

export type EqubStatus = 'open' | 'drawing' | 'completed';

export type EqubMember = {
  playerId: string;
  name: string;
  pick: number;
  joinedAt: number;
  isBot?: boolean;
};

export type EqubRoom = {
  id: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier: string;
  status: EqubStatus;
  members: EqubMember[];
  winningNumber: number | null;
  winnerId: string | null;
  entropyHex: string | null;
  commitmentHash: string | null;
  createdAt: number;
  updatedAt: number;
};

export type EqubUser = {
  playerId: string;
  name: string;
  balance: number;
  createdAt: number;
};

export type EqubHistoryItem = {
  id: string;
  roomId: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  pick: number;
  winningNumber: number;
  won: boolean;
  delta: number;
  at: number;
};

export const GROUP_SIZES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export const STARTING_BALANCE = 5000;

export function contributionOf(prizePool: number, groupSize: number) {
  return Math.round((prizePool / groupSize) * 100) / 100;
}

export function roomIdOf(groupSize: number, prizePool: number) {
  return `equb-${groupSize}-${prizePool}`;
}

export function buildTemplates(maxPrize = 9000): EqubRoom[] {
  const pools: number[] = [500];
  for (let p = 1000; p <= 9000; p += 1000) pools.push(p);
  for (let p = 10000; p <= Math.min(maxPrize, 90000); p += 10000) pools.push(p);

  const out: EqubRoom[] = [];
  const now = Date.now();
  for (const size of GROUP_SIZES) {
    for (const prize of pools) {
      if (prize > maxPrize) continue;
      const tier = prize <= 500 ? 'entry' : prize < 10000 ? 'low' : 'mid';
      out.push({
        id: roomIdOf(size, prize),
        groupSize: size,
        prizePool: prize,
        contribution: contributionOf(prize, size),
        tier,
        status: 'open',
        members: [],
        winningNumber: null,
        winnerId: null,
        entropyHex: null,
        commitmentHash: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return out;
}

/** Cryptographically strong-ish random int in [0, maxExclusive) using Web Crypto */
export function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error('invalid range');
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const x = buf[0]!;
    if (x < limit) return x % maxExclusive;
  }
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Draw only among taken seat numbers (fair equb among members who joined). */
export async function fairDrawAmongMembers(members: EqubMember[]): Promise<{
  winningNumber: number;
  winnerId: string;
  entropyHex: string;
  commitmentHash: string;
}> {
  if (members.length < 1) throw new Error('Need at least 1 member');
  const picks = members.map((m) => m.pick);
  const idx = secureRandomInt(picks.length);
  const winningNumber = picks[idx]!;
  const winner = members.find((m) => m.pick === winningNumber)!;
  const entropy = new Uint8Array(32);
  crypto.getRandomValues(entropy);
  const entropyHex = Array.from(entropy)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const commitmentHash = await sha256Hex(
    `${entropyHex}:${picks.join(',')}:${winningNumber}:${winner.playerId}`,
  );
  return {
    winningNumber,
    winnerId: winner.playerId,
    entropyHex,
    commitmentHash,
  };
}

const BOT_NAMES = [
  'Abebe', 'Tigist', 'Yonas', 'Hanna', 'Dawit', 'Meron', 'Kaleb', 'Sara',
  'Biruk', 'Selam', 'Nahom', 'Rahel', 'Elias', 'Kidist', 'Samuel', 'Bethlehem',
];

export function fillBots(room: EqubRoom, count: number): EqubMember[] {
  const taken = new Set(room.members.map((m) => m.pick));
  const available: number[] = [];
  for (let n = 1; n <= room.groupSize; n++) {
    if (!taken.has(n)) available.push(n);
  }
  // shuffle available
  for (let i = available.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [available[i], available[j]] = [available[j]!, available[i]!];
  }
  const bots: EqubMember[] = [];
  const n = Math.min(count, available.length);
  for (let i = 0; i < n; i++) {
    const name = BOT_NAMES[secureRandomInt(BOT_NAMES.length)]! + (100 + secureRandomInt(900));
    bots.push({
      playerId: `bot-${Date.now()}-${i}-${secureRandomInt(1e6)}`,
      name,
      pick: available[i]!,
      joinedAt: Date.now(),
      isBot: true,
    });
  }
  return bots;
}

export function newPlayerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
