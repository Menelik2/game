import { randomBytes, createHash } from 'crypto';
import { isDbConfigured } from './db-users';
import { createClient } from '@supabase/supabase-js';
import { computePayout, settleWinPayout } from './wallet-settle';
import { recordGameProfit } from './profit-ledger';
import { isFakePlayerId, isFakePlayerName, isRealPlayer } from '@/lib/real-players';

const ROUND_MS = 60_000;
/** Game starts only when at least 5 real players have joined. */
const MIN_PLAYERS = 5;
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
  collectedPot?: number | null;
  paidOut?: boolean;
  entropyHex: string | null;
  commitmentHash: string | null;
  drawAt: number;
  secondsLeft: number;
  updatedAt: number;
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

/** 5→1, 10→2, 20→3 … same ladder as equb-math.maxPicksForGroup */
function maxPicks(groupSize: number) {
  const ladder = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
  const size = Math.floor(Number(groupSize) || 0);
  const idx = ladder.indexOf(size as (typeof ladder)[number]);
  if (idx >= 0) return idx + 1;
  if (size <= 5) return 1;
  if (size <= 10) return 2;
  return Math.min(11, Math.max(1, Math.ceil(size / 10)));
}

function memberPicks(m: Member): number[] {
  if (m.picks && m.picks.length) return m.picks;
  return [m.pick];
}

function playerCount(room: SharedRoom): number {
  return room.members.filter((m) => isRealPlayer(m)).length;
}

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

/** Real pot = sum of fees players paid (contribution × picks), capped by prizePool. */
function collectedPot(room: SharedRoom, humans: Member[]): number {
  const unit = Number(room.contribution) || 0;
  const sum = humans.reduce((s, m) => s + unit * memberPicks(m).length, 0);
  const cap = Number(room.prizePool) || sum;
  const pot = cap > 0 ? Math.min(sum, cap) : sum;
  return Math.round(pot * 100) / 100;
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
    playerCount: pc,
    maxPlayers: room.groupSize,
    minPlayers: MIN_PLAYERS,
    gameId: room.id,
    joiningClosed: room.status !== 'open' || isFull({ ...room, members }),
    recent: (room.recent || []).filter(
      (r) => Boolean(r.winnerName) && !isFakePlayerName(r.winnerName),
    ),
    secondsLeft: Math.max(0, Math.ceil((room.drawAt - Date.now()) / 1000)),
  };
}

function parseTemplate(templateId: string): { groupSize: number; prizePool: number } {
  const m = /^equb-(\d+)-(\d+)$/.exec(templateId);
  if (!m) return { groupSize: 5, prizePool: 500 };
  return { groupSize: Number(m[1]), prizePool: Number(m[2]) };
}

function fresh(templateId: string, recent: SharedRoom['recent'] = []): SharedRoom {
  const { groupSize, prizePool } = parseTemplate(templateId);
  const now = Date.now();
  const id = `${templateId}-${now}`;
  return {
    id,
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
    collectedPot: null,
    paidOut: false,
    entropyHex: null,
    commitmentHash: null,
    drawAt: now + ROUND_MS,
    secondsLeft: ROUND_MS / 1000,
    updatedAt: now,
    gameId: id,
    recent: recent || [],
  };
}

async function read(templateId: string): Promise<SharedRoom | null> {
  if (!isDbConfigured()) return null;
  try {
    const { data, error } = await sb()
      .from('equb_live_rooms')
      .select('payload')
      .eq('template_id', templateId)
      .maybeSingle();
    if (error || !data?.payload) return null;
    return data.payload as SharedRoom;
  } catch {
    return null;
  }
}

async function write(room: SharedRoom): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await sb().from('equb_live_rooms').upsert({
      template_id: room.templateId,
      payload: room,
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* ignore */
  }
}

function cryptoDraw(groupSize: number): {
  winningNumber: number;
  entropyHex: string;
  commitmentHash: string;
} {
  const entropy = randomBytes(32);
  const entropyHex = entropy.toString('hex');
  const commitmentHash = createHash('sha256').update(entropy).digest('hex');
  const winningNumber = (entropy.readUInt32BE(0) % groupSize) + 1;
  return { winningNumber, entropyHex, commitmentHash };
}

async function drawAsync(room: SharedRoom): Promise<SharedRoom> {
  const now = Date.now();
  if (room.status === 'open' && now >= room.drawAt) {
    const humans = room.members.filter((m) => isRealPlayer(m));
    const pc = humans.length;
    // Wait for minimum 5 real players before starting the draw
    if (pc < MIN_PLAYERS) {
      room.drawAt = now + ROUND_MS;
      room.secondsLeft = ROUND_MS / 1000;
      room.updatedAt = now;
      await write(room);
      return room;
    }
    room.status = 'drawing';
    room.joiningClosed = true;
    room.updatedAt = now;
    await write(room);

    const { winningNumber, entropyHex, commitmentHash } = cryptoDraw(room.groupSize);
    room.winningNumber = winningNumber;
    room.entropyHex = entropyHex;
    room.commitmentHash = commitmentHash;

    const winners = humans.filter((m) => memberPicks(m).includes(winningNumber));
    const pot = collectedPot(room, humans);
    room.collectedPot = pot;
    const { winnerPayout, adminFee } = computePayout(pot || room.prizePool);
    room.adminFee = adminFee;
    room.winnerPayout = winnerPayout;

    if (winners.length === 1) {
      const w = winners[0]!;
      room.winnerId = w.playerId;
      room.winnerName = w.name;
      try {
        await settleWinPayout({
          userId: w.playerId,
          amount: winnerPayout,
          roomId: room.id,
          winningNumber,
        });
        room.paidOut = true;
      } catch {
        room.paidOut = false;
      }
    } else {
      room.winnerId = null;
      room.winnerName = winners.length > 1 ? 'Tie' : null;
    }

    try {
      await recordGameProfit({
        roomId: room.id,
        templateId: room.templateId,
        groupSize: room.groupSize,
        prizePool: pot || room.prizePool,
        adminFee,
        winnerPayout,
        winnerId: room.winnerId,
        winnerName: room.winnerName,
        winningNumber: room.winningNumber,
        seatsTaken: humans.length,
      });
    } catch {
      /* ignore */
    }

    room.status = 'completed';
    room.recent = [
      {
        id: room.id,
        winningNumber,
        winnerName: room.winnerName || '',
        pot,
        at: now,
      },
      ...(room.recent || []),
    ].slice(0, 20);
    room.updatedAt = now;
    await write(room);

    setTimeout(async () => {
      try {
        const kept = (room.recent || []).filter(
          (r) => Boolean(r.winnerName) && !isFakePlayerName(r.winnerName),
        );
        const next = fresh(room.templateId, kept);
        await write(next);
      } catch {
        /* ignore */
      }
    }, NEXT_CYCLE_DELAY_MS);
  }
  return room;
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
  return getShared(templateId);
}

export function sharedEnabled() {
  return isDbConfigured();
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
