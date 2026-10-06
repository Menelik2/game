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
  return (room.members || []).filter((m) => isRealPlayer(m));
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

export function withTimer(room: Room): Room {
  const secondsLeft = Math.max(0, Math.ceil((room.drawAt - Date.now()) / 1000));
  return {
    ...room,
    members: realMembers(room),
    secondsLeft,
    recent: (room.recent || []).filter(
      (r) =>
        Boolean(r.winnerName) &&
        !isFakePlayerName(r.winnerName) &&
        !isFakePlayerId(r.winnerId),
    ),
  };
}

function createRoom(templateId: string): Room {
  const match = /^equb-(\d+)-(\d+)$/.exec(templateId);
  if (!match) {
    // also accept size-prize
    const parts = String(templateId).split('-');
    const groupSize = Number(parts[parts[0] === 'equb' ? 1 : 0]) || 10;
    const prizePool = Number(parts[parts[0] === 'equb' ? 2 : 1]) || 1000;
    const contribution = contributionOf(prizePool, groupSize);
    const now = Date.now();
    const room: Room = {
      id: `${templateId}-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      templateId,
      groupSize,
      prizePool,
      contribution,
      tier: prizePool <= 500 ? 'entry' : prizePool < 10000 ? 'low' : 'mid',
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
      drawAt: now + ROUND_MS,
      secondsLeft: ROUND_MS / 1000,
      createdAt: now,
      updatedAt: now,
      recent: [],
    };
    rooms.set(room.id, room);
    return room;
  }
  const groupSize = parseInt(match[1], 10);
  const prizePool = parseInt(match[2], 10);
  const contribution = contributionOf(prizePool, groupSize);
  const now = Date.now();
  const room: Room = {
    id: `${templateId}-${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    templateId,
    groupSize,
    prizePool,
    contribution,
    tier: prizePool <= 500 ? 'entry' : prizePool < 10000 ? 'low' : 'mid',
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
    drawAt: now + ROUND_MS,
    secondsLeft: ROUND_MS / 1000,
    createdAt: now,
    updatedAt: now,
    recent: [],
  };
  rooms.set(room.id, room);
  return room;
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
      out.push({
        id: `equb-${size}-${prize}`,
        groupSize: size,
        prizePool: prize,
        contribution: contributionOf(prize, size),
        tier: prize <= 500 ? 'entry' : prize < 10000 ? 'low' : 'mid',
      });
    }
  }
  return out;
}

export function findOpen(templateId: string): Room | undefined {
  for (const r of rooms.values()) {
    if (r.templateId === templateId && r.status === 'open') return withTimer(r);
  }
  return undefined;
}

export function ensureOpen(templateId: string): Room {
  const existing = findOpen(templateId);
  if (existing) {
    const raw = rooms.get(existing.id);
    if (raw) void maybeDrawAsync(raw);
    return withTimer(rooms.get(existing.id) || existing);
  }
  const room = createRoom(templateId);
  rooms.set(room.id, room);
  return withTimer(room);
}

export function getRoom(id: string): Room | null {
  let room = rooms.get(id);
  if (!room) {
    room = [...rooms.values()].find((r) => r.id === id || r.templateId === id);
  }
  if (!room) return null;
  void maybeDrawAsync(room);
  return withTimer(rooms.get(room.id) || room);
}

export async function maybeDrawAsync(room: Room): Promise<Room> {
  if (room.status === 'completed' || room.status === 'drawing') {
    return withTimer(room);
  }
  if (room.status !== 'open') return withTimer(room);
  if (Date.now() < room.drawAt) return withTimer(room);

  room.members = realMembers(room);
  if (seatsTaken(room) < 1) {
    room.drawAt = Date.now() + ROUND_MS;
    room.updatedAt = Date.now();
    rooms.set(room.id, room);
    return withTimer(room);
  }

  room.status = 'drawing';
  rooms.set(room.id, room);

  const humans = realMembers(room);
  const allPicks: { member: Member; n: number }[] = [];
  for (const m of humans) {
    for (const n of memberPicks(m)) allPicks.push({ member: m, n });
  }
  if (allPicks.length === 0) {
    room.status = 'open';
    room.drawAt = Date.now() + ROUND_MS;
    rooms.set(room.id, room);
    return withTimer(room);
  }

  const entropyHex = randomBytes(16).toString('hex');
  const buf = randomBytes(4);
  const idx = buf.readUInt32BE(0) % allPicks.length;
  const chosen = allPicks[idx]!;
  const winningNumber = chosen.n;
  const winner = chosen.member;

  const { adminFee, winnerPayout } = computePayout(room.prizePool);

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
  room.members = humans;

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
      (r) => Boolean(r.winnerName) && !isFakePlayerName(r.winnerName),
    ),
  ].slice(0, 20);
  rooms.set(room.id, room);
  return withTimer(room);
}

export function maybeDraw(room: Room): Room {
  if (room.status === 'completed' || room.status === 'drawing') {
    return withTimer(room);
  }
  if (room.status !== 'open') return withTimer(room);
  if (Date.now() < room.drawAt) return withTimer(room);
  if (seatsTaken(room) < 1) {
    room.drawAt = Date.now() + ROUND_MS;
    room.updatedAt = Date.now();
    rooms.set(room.id, room);
    return withTimer(room);
  }
  void maybeDrawAsync(room);
  return withTimer(rooms.get(room.id) || room);
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
    const created = createRoom(templateId);
    rooms.set(created.id, created);
    room = withTimer(created);
  }

  const raw = rooms.get(room.id);
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
  raw.members = realMembers(raw);
  raw.updatedAt = Date.now();
  rooms.set(raw.id, raw);
  return withTimer(raw);
}

export function listRooms(): Room[] {
  return [...rooms.values()].map((r) => {
    void maybeDrawAsync(r);
    return withTimer(rooms.get(r.id) || r);
  });
}
