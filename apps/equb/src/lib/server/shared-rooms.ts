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
  /** Actual Birr collected from players this round */
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

/**
 * Real money in the pot = what players actually paid this round.
 * contribution × number of picks per member, capped by template prizePool.
 */
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
    await sb().from('equb_live_rooms').upsert(
      {
        template_id: room.templateId,
        payload: room,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'template_id' },
    );
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
 *
 * Money rules (peer pot):
 * - Each join debits contribution × picks from the player
 * - At draw, pot = sum of those fees (capped by prizePool)
 * - Winner receives (1 − platformFee) of pot; platform keeps fee
 */
async function drawAsync(room: SharedRoom): Promise<SharedRoom> {
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

  if (count < MIN_PLAYERS) {
    room.status = 'open';
    room.drawAt = Date.now() + ROUND_MS;
    room.updatedAt = Date.now();
    room.joiningClosed = false;
    await write(room);
    return withTimer(room);
  }

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

  // Peer pot from real contributions only
  const pot = collectedPot(room, humans);
  const gross = pot > 0 ? pot : Number(room.prizePool) || 0;
  const { adminFee, winnerPayout } = computePayout(gross);

  room.winningNumber = winningNumber;
  room.winnerId = winner?.playerId ?? null;
  room.winnerName = winner?.name ?? null;
  room.adminFee = adminFee;
  room.winnerPayout = winnerPayout;
  room.collectedPot = gross;
  room.entropyHex = entropyHex;
  room.commitmentHash = createHash('sha256')
    .update(`${entropyHex}:${winningNumber}`)
    .digest('hex');
  room.updatedAt = Date.now();

  // Auto-credit winner from the pooled Birr
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
      prizePool: gross,
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
      pot: winnerPayout > 0 ? winnerPayout : gross,
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
  return getShared(templateId);
}

export async function joinShared(
  templateId: string,
  member: Member,
  picks: number[],
): Promise<SharedRoom> {
  let room = await getShared(templateId);
  if (room.status !== 'open' || room.joiningClosed) {
    throw new Error('Joining closed — wait for next cycle');
  }
  if (isFakePlayerId(member.playerId) || isFakePlayerName(member.name)) {
    throw new Error('Invalid player');
  }
  const max = maxPicks(room.groupSize);
  const clean = [...new Set(picks.map((n) => Math.floor(Number(n))))]
    .filter((n) => n >= 1 && n <= room.groupSize)
    .slice(0, max);
  if (!clean.length) throw new Error('Select at least one number');

  const taken = takenSet(room);
  for (const p of clean) {
    if (taken.has(p)) throw new Error(`Number ${p} already taken`);
  }
  if (seatsTaken(room) + clean.length > room.groupSize) {
    throw new Error('Room full');
  }
  if (room.members.some((m) => m.playerId === member.playerId)) {
    throw new Error('Already joined this round');
  }

  room.members = [
    ...room.members,
    {
      ...member,
      pick: clean[0]!,
      picks: clean,
      joinedAt: Date.now(),
    },
  ];
  room.updatedAt = Date.now();
  await write(room);
  return withTimer(room);
}

export function sharedEnabled() {
  return isDbConfigured();
}
