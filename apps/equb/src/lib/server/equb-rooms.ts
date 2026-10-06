import { randomBytes, createHash } from 'crypto';
import { computePayout, settleWinPayout } from './wallet-settle';
import { isFakePlayerId, isFakePlayerName, isRealPlayer } from '@/lib/real-players';

const ROUND_MS = 60_000;
const GROUP_SIZES = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
];

export type Member = {
  playerId: string;
  name: string;
  pick: number;
  picks?: number[];
  joinedAt: number;
};

export type Room = {
  id: string;
  templateId: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier: string;
  status: 'open' | 'drawing' | 'completed';
  members: Member[];
  winningNumber: number | null;
  winnerId: string | null;
  winnerName: string | null;
  adminFee: number | null;
  winnerPayout: number | null;
  paidOut?: boolean;
  entropyHex: string | null;
  commitmentHash: string | null;
  drawAt: number;
  secondsLeft: number;
  createdAt: number;
  updatedAt: number;
  recent?: Array<{
    id: string;
    winningNumber: number;
    winnerName: string;
    pot: number;
    at: number;
    winnerId?: string;
  }>;
};

const g = globalThis as unknown as { __equbRooms?: Map<string, Room> };
if (!g.__equbRooms) g.__equbRooms = new Map();
const rooms = g.__equbRooms;

function maxPicks(groupSize: number) {
  return Math.max(1, Math.floor(groupSize / 5));
}

function memberPicks(m: Member): number[] {
  if (m.picks && m.picks.length) return m.picks;
  return [m.pick];
}

function realMembers(room: Room): Member[] {
  return room.members.filter((m) => isRealPlayer(m));
}

function seatsTaken(room: Room) {
  return realMembers(room).reduce((n, m) => n + memberPicks(m).length, 0);
}

function takenSet(room: Room) {
  const s = new Set<number>();
  for (const m of realMembers(room)) for (const p of memberPicks(m)) s.add(p);
  return s;
}

function contributionOf(prizePool: number, groupSize: number) {
  return Math.round((prizePool / groupSize) * 100) / 100;
}

function withTimer(room: Room): Room {
  const secondsLeft = Math.max(0, Math.ceil((room.drawAt - Date.now()) / 1000));
  // Never expose fake members to clients
  return {
    ...room,
    members: realMembers(room),
    secondsLeft,
    recent: (room.recent || []).filter(
      (r) => r.winnerName && !isFakePlayerName(r.winnerName),
    ),
  };
}

function parseTemplate(templateId: string) {
  // template: size-prize e.g. 10-5000
  const parts = String(templateId).split('-');
  const groupSize = Number(parts[0]) || 10;
  const prizePool = Number(parts[1]) || 1000;
  const contribution = contributionOf(prizePool, groupSize);
  let tier = 'bronze';
  if (prizePool >= 50000) tier = 'diamond';
  else if (prizePool >= 10000) tier = 'gold';
  else if (prizePool >= 3000) tier = 'silver';
  return { groupSize, prizePool, contribution, tier };
}

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
      const contribution = contributionOf(prize, size);
      let tier = 'bronze';
      if (prize >= 50000) tier = 'diamond';
      else if (prize >= 10000) tier = 'gold';
      else if (prize >= 3000) tier = 'silver';
      out.push({
        id: `${size}-${prize}`,
        groupSize: size,
        prizePool: prize,
        contribution,
        tier,
      });
    }
  }
  return out;
}

export function createRoom(templateId: string): Room {
  const meta = parseTemplate(templateId);
  const id = `${templateId}-${Date.now().toString(36)}`;
  const room: Room = {
    id,
    templateId,
    ...meta,
    status: 'open',
    members: [],
    winningNumber: null,
    winnerId: null,
    winnerName: null,
    adminFee: null,
    winnerPayout: null,
    paidOut: false,
    entropyHex: null,
    commitmentHash: null,
    drawAt: Date.now() + ROUND_MS,
    secondsLeft: ROUND_MS / 1000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    recent: [],
  };
  rooms.set(room.id, room);
  rooms.set(templateId, room);
  return withTimer(room);
}

export function ensureOpen(templateId: string): Room {
  let room = rooms.get(templateId);
  if (!room || room.status === 'completed') {
    const recent = room?.recent || [];
    room = createRoom(templateId);
    room.recent = recent;
    rooms.set(templateId, room);
  }
  void maybeDrawAsync(room);
  return withTimer(rooms.get(templateId) || room);
}

function secureRandomInt(max: number) {
  if (max <= 0) return 0;
  const buf = randomBytes(4);
  return buf.readUInt32BE(0) % max;
}

async function maybeDrawAsync(room: Room) {
  if (room.status === 'completed' || room.status === 'drawing') return;
  if (room.status !== 'open') return;
  if (Date.now() < room.drawAt) return;

  const humans = realMembers(room);
  if (humans.length < 1) {
    room.drawAt = Date.now() + ROUND_MS;
    room.updatedAt = Date.now();
    rooms.set(room.id, room);
    rooms.set(room.templateId, room);
    return;
  }

  room.status = 'drawing';
  rooms.set(room.id, room);
  rooms.set(room.templateId, room);

  // Only real players' numbers
  const allPicks: { member: Member; n: number }[] = [];
  for (const m of humans) {
    for (const n of memberPicks(m)) allPicks.push({ member: m, n });
  }
  if (allPicks.length === 0) {
    room.status = 'open';
    room.drawAt = Date.now() + ROUND_MS;
    rooms.set(room.id, room);
    return;
  }

  const entropyHex = randomBytes(16).toString('hex');
  const idx = secureRandomInt(allPicks.length);
  const chosen = allPicks[idx]!;
  const winningNumber = chosen.n;
  const winner = chosen.member;

  const pot = room.prizePool;
  const adminFee = Math.round(pot * 0.15 * 100) / 100;
  const winnerPayout = Math.round((pot - adminFee) * 100) / 100;

  room.winningNumber = winningNumber;
  room.winnerId = winner.playerId;
  room.winnerName = winner.name;
  room.adminFee = adminFee;
  room.winnerPayout = winnerPayout;
  room.entropyHex = entropyHex;
  room.commitmentHash = createHash('sha256')
    .update(`${entropyHex}:${winningNumber}`)
    .digest('hex');
  room.updatedAt = Date.now();
  room.members = humans; // drop any leftover fakes

  if (winner.playerId && winnerPayout > 0 && !room.paidOut) {
    try {
      await settleWinPayout({
        userId: winner.playerId,
        amount: winnerPayout,
        roomId: room.id,
        winningNumber,
      });
      room.paidOut = true;
    } catch {
      room.paidOut = false;
    }
  }

  room.status = 'completed';
  room.recent = [
    {
      id: room.id,
      winningNumber,
      winnerName: winner.name,
      winnerId: winner.playerId,
      pot: room.prizePool,
      at: Date.now(),
    },
    ...(room.recent || []).filter(
      (r) => r.winnerName && !isFakePlayerName(r.winnerName),
    ),
  ].slice(0, 20);

  rooms.set(room.id, room);
  rooms.set(room.templateId, room);
}

export function joinRoom(
  templateId: string,
  playerId: string,
  name: string,
  pickOrPicks: number | number[],
): Room {
  if (isFakePlayerId(playerId) || isFakePlayerName(name)) {
    throw new Error('Real account required — demo/bot players not allowed');
  }

  let room = ensureOpen(templateId);
  if (room.status !== 'open') {
    room = withTimer(createRoom(templateId));
  }

  // Work on the raw room in the map
  const raw = rooms.get(templateId) || rooms.get(room.id);
  if (!raw) throw new Error('Room not found');

  if (raw.members.some((m) => m.playerId === playerId)) {
    throw new Error('Already in this room');
  }

  const rawPicks = Array.isArray(pickOrPicks) ? pickOrPicks : [pickOrPicks];
  const max = maxPicks(raw.groupSize);
  const picks = [...new Set(rawPicks.map((n) => Math.floor(Number(n))))].filter(
    (n) => n >= 1 && n <= raw.groupSize,
  );
  if (picks.length === 0) throw new Error(`Pick 1–${max} number(s)`);
  if (picks.length > max) {
    throw new Error(`Max ${max} numbers for ${raw.groupSize}-player room`);
  }

  const taken = takenSet(raw);
  for (const p of picks) {
    if (taken.has(p)) throw new Error(`Number ${p} already taken`);
  }
  if (seatsTaken(raw) + picks.length > raw.groupSize) {
    throw new Error('Not enough seats left');
  }

  raw.members.push({
    playerId,
    name: (name || 'Player').slice(0, 40),
    pick: picks[0]!,
    picks,
    joinedAt: Date.now(),
  });
  // Strip any fakes that may have been stored earlier
  raw.members = realMembers(raw);
  raw.updatedAt = Date.now();
  rooms.set(raw.id, raw);
  rooms.set(templateId, raw);
  return withTimer(raw);
}

export function listRooms(): Room[] {
  return [...rooms.values()]
    .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
    .map((r) => {
      void maybeDrawAsync(r);
      return withTimer(rooms.get(r.id) || r);
    });
}

export function getRoom(id: string): Room | null {
  const room = rooms.get(id) || [...rooms.values()].find((r) => r.id === id);
  if (!room) return null;
  void maybeDrawAsync(room);
  return withTimer(rooms.get(room.id) || room);
}
