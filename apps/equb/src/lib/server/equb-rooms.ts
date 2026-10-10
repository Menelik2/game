import { randomBytes, createHash } from 'crypto';
import {
  computePayout,
  settleWinPayout,
  refundJoinFee,
} from './wallet-settle';
import { isFakePlayerId, isFakePlayerName, isRealPlayer } from '@/lib/real-players';

const ROUND_MS = 60_000;
/** Join capacity only: 5, then every 10 up to 100 */
const GROUP_SIZES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

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

/** 5→1, 10→2, … 100→11 */
function maxPicks(groupSize: number) {
  const ladder = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
  const size = Math.floor(Number(groupSize) || 0);
  const idx = ladder.indexOf(size as (typeof ladder)[number]);
  if (idx >= 0) return idx + 1;
  if (size <= 5) return 1;
  if (size <= 10) return 2;
  return Math.min(11, Math.max(1, Math.ceil(size / 10)));
}

const MIN_PLAYERS = 5;

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
  let groupSize: number;
  let prizePool: number;
  if (match) {
    groupSize = Number(match[1]);
    prizePool = Number(match[2]);
  } else {
    const parts = String(templateId).split('-');
    groupSize = Number(parts[parts[0] === 'equb' ? 1 : 0]) || 10;
    prizePool = Number(parts[parts[0] === 'equb' ? 2 : 1]) || 1000;
  }
  if (!GROUP_SIZES.includes(groupSize)) {
    groupSize = GROUP_SIZES.reduce((a, b) =>
      Math.abs(b - groupSize) < Math.abs(a - groupSize) ? b : a,
    );
  }
  const contribution = contributionOf(prizePool, groupSize);
  const now = Date.now();
  const id = `${templateId}-${now}`;
  return {
    id,
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
}

export function listTemplates() {
  const prizes = [500, 1000, 2000, 5000, 9000, 10000, 20000, 50000, 90000];
  const out: Array<{
    id: string;
    groupSize: number;
    prizePool: number;
    contribution: number;
    tier: string;
  }> = [];
  for (const groupSize of GROUP_SIZES) {
    for (const prize of prizes) {
      out.push({
        id: `equb-${groupSize}-${prize}`,
        groupSize,
        prizePool: prize,
        contribution: contributionOf(prize, groupSize),
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
  const humans = realMembers(room);
  if (humans.length < MIN_PLAYERS) {
    room.drawAt = Date.now() + ROUND_MS;
    room.updatedAt = Date.now();
    rooms.set(room.id, room);
    return withTimer(room);
  }

  room.status = 'drawing';
  rooms.set(room.id, room);

  // Fair RNG: 1..groupSize (NOT only from selected picks)
  const entropy = randomBytes(32);
  const entropyHex = entropy.toString('hex');
  const n = Math.max(1, Math.floor(room.groupSize) || 1);
  const winningNumber = (entropy.readUInt32BE(0) % n) + 1;
  const commitmentHash = createHash('sha256').update(entropy).digest('hex');

  const unit = Number(room.contribution) || 0;
  const pot =
    Math.round(
      humans.reduce((s, m) => s + unit * memberPicks(m).length, 0) * 100,
    ) / 100;

  const winners = humans.filter((m) => memberPicks(m).includes(winningNumber));

  room.winningNumber = winningNumber;
  room.entropyHex = entropyHex;
  room.commitmentHash = commitmentHash;
  room.updatedAt = Date.now();
  room.members = humans;

  if (pot <= 0) {
    room.adminFee = 0;
    room.winnerPayout = 0;
    room.winnerId = null;
    room.winnerName = null;
    room.paidOut = false;
  } else if (winners.length === 1) {
    const { adminFee, winnerPayout } = computePayout(pot);
    room.adminFee = adminFee;
    room.winnerPayout = winnerPayout;
    const winner = winners[0]!;
    room.winnerId = winner.playerId;
    room.winnerName = winner.name;
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
  } else {
    room.adminFee = 0;
    room.winnerPayout = 0;
    room.winnerId = null;
    room.winnerName = winners.length > 1 ? 'Tie' : null;
    room.paidOut = false;
    for (const m of humans) {
      const fee = Math.round(unit * memberPicks(m).length * 100) / 100;
      if (fee <= 0) continue;
      try {
        await refundJoinFee({
          userId: m.playerId,
          amount: fee,
          roomId: room.id,
        });
      } catch {
        /* best effort */
      }
    }
  }

  room.status = 'completed';
  room.recent = [
    {
      id: room.id,
      winningNumber,
      winnerName: room.winnerName || '',
      winnerId: room.winnerId || undefined,
      pot,
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
  if (realMembers(room).length < MIN_PLAYERS) {
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
    throw new Error(`Max ${max} number(s) for this room`);
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

export { MIN_PLAYERS, ROUND_MS, GROUP_SIZES };
