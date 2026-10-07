import { randomBytes, createHash } from 'crypto';
import { isDbConfigured } from './db-users';
import { createClient } from '@supabase/supabase-js';
import { computePayout, settleWinPayout } from './wallet-settle';
import { recordGameProfit } from './profit-ledger';
import { isFakePlayerId, isFakePlayerName, isRealPlayer } from '@/lib/real-players';

/** Cycle length: 60 seconds */
const ROUND_MS = 60_000;
/** Minimum unique players required to start a draw when timer ends */
const MIN_PLAYERS = 2;
/** Brief pause after a completed game before opening the next cycle */
const NEXT_CYCLE_DELAY_MS = 8_000;

export type Member = {
  playerId: string;
  name: string;
  pick: number;
  picks?: number[];
  joinedAt: number;
};
export type SharedRoom = {
  id: string;
  templateId: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  status: 'open' | 'drawing' | 'completed' | 'waiting';
  members: Member[];
  winningNumber: number | null;
  winnerId: string | null;
  winnerName: string | null;
  adminFee?: number | null;
  winnerPayout?: number | null;
  paidOut?: boolean;
  entropyHex: string | null;
  commitmentHash: string | null;
  drawAt: number;
  secondsLeft: number;
  updatedAt: number;
  /** Unique Game ID for this cycle (same as id) */
  gameId?: string;
  playerCount?: number;
  maxPlayers?: number;
  minPlayers?: number;
  joiningClosed?: boolean;
  recent?: Array<{
    id: string;
    winningNumber: number;
    winnerName: string;
    pot: number;
    at: number;
  }>;
};

function maxPicks(groupSize: number) {
  const size = Math.floor(Number(groupSize) || 0);
  if (size <= 5) return 1;
  return 2;
}
function memberPicks(m: Member): number[] {
  if (m.picks && m.picks.length) return m.picks;
  return [m.pick];
}
/** Unique real players in the room */
function playerCount(room: SharedRoom): number {
  return room.members.filter((m) => isRealPlayer(m)).length;
}
/** Seats occupied (picks), capped by groupSize */
function seatsTaken(room: SharedRoom) {
  return room.members
    .filter((m) => isRealPlayer(m))
    .reduce((n, m) => n + memberPicks(m).length, 0);
}
function takenSet(room: SharedRoom) {
  const s = new Set<number>();
  for (const m of room.members.filter((m) => isRealPlayer(m))) {
    for (const p of memberPicks(m)) s.add(p);
  }
  return s;
}
function isFull(room: SharedRoom) {
  return seatsTaken(room) >= room.groupSize;
}

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return createClient(url, key, { auth: { persistSession: false } });
}

function withTimer(room: SharedRoom): SharedRoom {
  const members = (room.members || []).filter((m) => isRealPlayer(m));
  const pc = members.length;
  return {
    ...room,
    members,
    gameId: room.id,
    playerCount: pc,
    maxPlayers: room.groupSize,
    minPlayers: MIN_PLAYERS,
    joiningClosed: room.status !== 'open' || isFull({ ...room, members }),
    recent: (room.recent || []).filter(
      (r) => Boolean(r.winnerName) && !isFakePlayerName(r.winnerName),
    ),
    secondsLeft: Math.max(0, Math.ceil((room.drawAt - Date.now()) / 1000)),
  };
}

function fresh(templateId: string, recent: SharedRoom['recent'] = []): SharedRoom {
  const m = /^equb-(\d+)-(\d+)$/.exec(templateId);
  if (!m) throw new Error('Invalid room');
  const groupSize = Number(m[1]);
  const prizePool = Number(m[2]);
  const now = Date.now();
  const id = `${templateId}-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    gameId: id,
    templateId,
    groupSize,
    prizePool,
    contribution: Math.round((prizePool / groupSize) * 100) / 100,
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
    secondsLeft: 60,
    updatedAt: now,
    playerCount: 0,
    maxPlayers: groupSize,
    minPlayers: MIN_PLAYERS,
    joiningClosed: false,
    recent: recent || [],
  };
}

export function sharedEnabled() {
  return isDbConfigured();
}

async function read(templateId: string): Promise<SharedRoom | null> {
  if (!isDbConfigured()) return null;
  try {
    const { data } = await sb()
      .from('equb_live_rooms')
      .select('payload')
      .eq('template_id', templateId)
      .maybeSingle();
    if (data?.payload) return data.payload as SharedRoom;
  } catch {
    /* */
  }
  return null;
}

async function write(room: SharedRoom) {
  if (!isDbConfigured()) return;
  try {
    await sb().from('equb_live_rooms').upsert({
      template_id: room.templateId,
      payload: room,
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* */
  }
}

/**
 * Game start rules:
 * - Every 60s check player count
 * - Need >= MIN_PLAYERS (2) unique players to start
 * - If fewer: keep waiting, roll timer another 60s (same Game ID)
 * - If enough: close joining, run draw, then open next cycle with new Game ID
 */
async function drawAsync(room: SharedRoom): Promise<SharedRoom> {
  // After a completed game, open the next cycle
  if (room.status === 'completed') {
    const age = Date.now() - (room.updatedAt || 0);
    if (age >= NEXT_CYCLE_DELAY_MS) {
      const next = fresh(
        room.templateId,
        (room.recent || []).filter(
          (r) => Boolean(r.winnerName) && !isFakePlayerName(r.winnerName),
        ),
      );
      await write(next);
      return withTimer(next);
    }
    return withTimer(room);
  }

  if (room.status === 'drawing') return withTimer(room);
  if (room.status !== 'open' && room.status !== 'waiting') return withTimer(room);
  if (Date.now() < room.drawAt) return withTimer(room);

  room.members = (room.members || []).filter((m) => isRealPlayer(m));
  const count = playerCount(room);

  // Not enough players — keep waiting, new 60s cycle on SAME game
  if (count < MIN_PLAYERS) {
    room.status = 'open';
    room.drawAt = Date.now() + ROUND_MS;
    room.updatedAt = Date.now();
    room.joiningClosed = false;
    await write(room);
    return withTimer(room);
  }

  // Enough players — close joining and start the game
  room.status = 'drawing';
  room.joiningClosed = true;
  room.updatedAt = Date.now();
  await write(room);

  const humans = room.members.filter((m) => isRealPlayer(m));
  const allPicks: { member: Member; n: number }[] = [];
  for (const m of humans) {
    for (const n of memberPicks(m)) allPicks.push({ member: m, n });
  }
  if (!allPicks.length) {
    room.status = 'open';
    room.joiningClosed = false;
    room.drawAt = Date.now() + ROUND_MS;
    await write(room);
    return withTimer(room);
  }

  const entropyHex = randomBytes(16).toString('hex');
  const idx = randomBytes(4).readUInt32BE(0) % allPicks.length;
  const chosen = allPicks[idx]!;
  const winningNumber = chosen.n;
  const winner = chosen.member;
  const { adminFee, winnerPayout } = computePayout(room.prizePool);

  room.winningNumber = winningNumber;
  room.winnerId = winner?.playerId ?? null;
  room.winnerName = winner?.name ?? null;
  room.adminFee = adminFee;
  room.winnerPayout = winnerPayout;
  room.entropyHex = entropyHex;
  room.commitmentHash = createHash('sha256')
    .update(`${entropyHex}:${winningNumber}`)
    .digest('hex');
  room.updatedAt = Date.now();

  if (winner?.playerId && winnerPayout > 0 && !room.paidOut) {
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
  room.joiningClosed = true;
  try {
    recordGameProfit({
      roomId: room.id,
      templateId: room.templateId,
      groupSize: room.groupSize,
      prizePool: room.prizePool,
      adminFee,
      winnerPayout,
      winnerId: room.winnerId,
      winnerName: room.winnerName,
      winningNumber,
      seatsTaken: seatsTaken(room),
      completedAtMs: Date.now(),
    });
  } catch {
    /* non-blocking */
  }
  room.recent = [
    {
      id: room.id,
      winningNumber,
      winnerName: winner?.name || 'Player',
      pot: room.prizePool,
      at: Date.now(),
    },
    ...(room.recent || []).filter(
      (r) => Boolean(r.winnerName) && !isFakePlayerName(r.winnerName),
    ),
  ].slice(0, 20);
  await write(room);
  return withTimer(room);
}

export async function getShared(templateId: string): Promise<SharedRoom> {
  let room = await read(templateId);
  if (!room) {
    room = fresh(templateId);
    await write(room);
  }
  room = await drawAsync(room);
  return withTimer(room);
}

export async function peekShared(templateId: string): Promise<SharedRoom | null> {
  const room = await read(templateId);
  return room ? withTimer(room) : null;
}

export async function openShared(templateId: string): Promise<SharedRoom> {
  let room = await read(templateId);
  const recent = room?.recent || [];
  if (!room) {
    room = fresh(templateId);
  } else if (room.status === 'completed') {
    room = fresh(templateId, recent);
  } else {
    room = await drawAsync(room);
  }
  await write(room);
  return withTimer(room);
}

export async function joinShared(
  templateId: string,
  playerId: string,
  name: string,
  pickOrPicks: number | number[],
): Promise<SharedRoom> {
  if (isFakePlayerId(playerId) || isFakePlayerName(name)) {
    throw new Error('Real account required — demo/bot players not allowed');
  }
  let room = await read(templateId);
  if (!room) room = fresh(templateId);
  room = await drawAsync(room);

  // If previous cycle finished, open the next game
  if (room.status === 'completed' || room.status === 'drawing') {
    if (room.status === 'completed') {
      const kept = (room.recent || []).filter(
        (r) => Boolean(r.winnerName) && !isFakePlayerName(r.winnerName),
      );
      room = fresh(templateId, kept);
    } else {
      throw new Error('Game already started — joining closed');
    }
  }

  if (room.status !== 'open') {
    throw new Error('Joining is closed for this game');
  }

  if (room.members.some((m) => m.playerId === playerId)) {
    return withTimer(room);
  }

  // Max player / seat limit
  if (isFull(room)) {
    throw new Error(`Room full (${room.groupSize}/${room.groupSize} players)`);
  }

  const raw = Array.isArray(pickOrPicks) ? pickOrPicks : [pickOrPicks];
  const max = maxPicks(room.groupSize);
  const picks = [...new Set(raw.map((n) => Math.floor(Number(n))))].filter(
    (n) => n >= 1 && n <= room.groupSize,
  );
  if (picks.length === 0) throw new Error(`Pick 1–${max} number(s)`);
  if (picks.length > max) {
    throw new Error(`Max ${max} number(s) for this room`);
  }
  const taken = takenSet(room);
  for (const p of picks) {
    if (taken.has(p)) throw new Error(`Number ${p} already taken`);
  }
  if (seatsTaken(room) + picks.length > room.groupSize) {
    throw new Error(`Not enough seats — max ${room.groupSize} players`);
  }

  room.members.push({
    playerId,
    name: (name || 'Player').slice(0, 40),
    pick: picks[0]!,
    picks,
    joinedAt: Date.now(),
  });
  room.members = room.members.filter((m) => isRealPlayer(m));
  room.updatedAt = Date.now();
  await write(room);
  return withTimer(room);
}

export async function listSharedOpen(): Promise<SharedRoom[]> {
  return [];
}

export { MIN_PLAYERS, ROUND_MS };
