import { randomBytes, createHash } from 'crypto';
import { isDbConfigured } from './db-users';
import { createClient } from '@supabase/supabase-js';
import { computePayout, settleWinPayout } from './wallet-settle';

const ROUND_MS = 60_000;
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
  status: 'open' | 'drawing' | 'completed';
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
  recent?: Array<{
    id: string;
    winningNumber: number;
    winnerName: string;
    pot: number;
    at: number;
  }>;
};

function maxPicks(groupSize: number) {
  return Math.max(1, Math.floor(groupSize / 5));
}
function memberPicks(m: Member): number[] {
  if (m.picks && m.picks.length) return m.picks;
  return [m.pick];
}
function seatsTaken(room: SharedRoom) {
  return room.members.reduce((n, m) => n + memberPicks(m).length, 0);
}
function takenSet(room: SharedRoom) {
  const s = new Set<number>();
  for (const m of room.members) for (const p of memberPicks(m)) s.add(p);
  return s;
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
  return {
    ...room,
    secondsLeft: Math.max(0, Math.ceil((room.drawAt - Date.now()) / 1000)),
  };
}

function fresh(templateId: string): SharedRoom {
  const m = /^equb-(\d+)-(\d+)$/.exec(templateId);
  if (!m) throw new Error('Invalid room');
  const groupSize = Number(m[1]);
  const prizePool = Number(m[2]);
  const now = Date.now();
  return {
    id: `${templateId}-${now.toString(36)}`,
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
    recent: [],
  };
}

async function read(templateId: string): Promise<SharedRoom | null> {
  if (!isDbConfigured()) return null;
  const { data, error } = await sb()
    .from('equb_live_rooms')
    .select('payload')
    .eq('template_id', templateId)
    .maybeSingle();
  if (error || !data?.payload) return null;
  return data.payload as SharedRoom;
}

async function write(room: SharedRoom) {
  if (!isDbConfigured()) return;
  const { error } = await sb().from('equb_live_rooms').upsert({
    template_id: room.templateId,
    payload: room,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** Awaited draw + wallet credit for the single winner */
async function drawAsync(room: SharedRoom): Promise<SharedRoom> {
  if (room.status === 'completed' || room.status === 'drawing') {
    return withTimer(room);
  }
  if (room.status !== 'open' || Date.now() < room.drawAt) return withTimer(room);
  if (seatsTaken(room) < 1) {
    room.drawAt = Date.now() + ROUND_MS;
    return withTimer(room);
  }

  room.status = 'drawing';

  const entropy = randomBytes(32);
  const entropyHex = entropy.toString('hex');
  const allPicks = room.members.flatMap((m) => memberPicks(m));
  let winningNumber = (entropy.readUInt32BE(0) % room.groupSize) + 1;
  if (!allPicks.includes(winningNumber)) {
    winningNumber = allPicks[entropy.readUInt8(4) % allPicks.length]!;
  }
  const winner = room.members.find((m) => memberPicks(m).includes(winningNumber));
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
  const row = {
    id: room.id,
    winningNumber,
    winnerName: winner?.name || 'Player',
    pot: room.prizePool,
    at: Date.now(),
  };
  room.recent = [row, ...(room.recent || [])].slice(0, 20);
  return withTimer(room);
}

export async function openShared(templateId: string): Promise<SharedRoom> {
  let room = await read(templateId);
  const recent = room?.recent || [];
  if (!room || room.status === 'completed') {
    room = fresh(templateId);
    room.recent = recent;
  } else {
    room = await drawAsync(room);
  }
  // Keep completed room visible briefly so clients see winner + paidOut
  // New round starts only after clients have had a chance to poll, or if already paid
  if (room.status === 'completed' && room.paidOut && Date.now() - room.updatedAt > 15_000) {
    const kept = room.recent || recent;
    room = fresh(templateId);
    room.recent = kept;
  }
  await write(room);
  return withTimer(room);
}

export async function getShared(templateId: string): Promise<SharedRoom> {
  let room = await read(templateId);
  if (!room) room = fresh(templateId);
  room = await drawAsync(room);
  await write(room);
  return withTimer(room);
}

export async function joinShared(
  templateId: string,
  playerId: string,
  name: string,
  pickOrPicks: number | number[],
): Promise<SharedRoom> {
  let room = await read(templateId);
  if (!room) room = fresh(templateId);
  room = await drawAsync(room);
  if (room.status !== 'open') {
    const kept = room.recent || [];
    room = fresh(templateId);
    room.recent = kept;
  }
  if (room.members.some((m) => m.playerId === playerId)) {
    throw new Error('Already in this room');
  }

  const raw = Array.isArray(pickOrPicks) ? pickOrPicks : [pickOrPicks];
  const max = maxPicks(room.groupSize);
  const picks = [...new Set(raw.map((n) => Math.floor(Number(n))))].filter(
    (n) => n >= 1 && n <= room.groupSize,
  );
  if (picks.length === 0) throw new Error(`Pick 1–${max} number(s)`);
  if (picks.length > max) {
    throw new Error(`Max ${max} numbers for ${room.groupSize}-player room`);
  }
  const taken = takenSet(room);
  for (const p of picks) {
    if (taken.has(p)) throw new Error(`Number ${p} is taken`);
  }
  if (seatsTaken(room) + picks.length > room.groupSize) {
    throw new Error('Not enough seats left');
  }

  room.members.push({
    playerId,
    name: name.slice(0, 40),
    pick: picks[0]!,
    picks,
    joinedAt: Date.now(),
  });
  room.updatedAt = Date.now();
  await write(room);
  return withTimer(room);
}

export async function listSharedOpen(): Promise<SharedRoom[]> {
  if (!isDbConfigured()) return [];
  const { data, error } = await sb()
    .from('equb_live_rooms')
    .select('payload, updated_at')
    .order('updated_at', { ascending: false })
    .limit(80);
  if (error || !data) return [];
  const out: SharedRoom[] = [];
  for (const row of data) {
    let room = row.payload as SharedRoom;
    if (!room?.templateId) continue;
    room = await drawAsync({ ...room });
    if (room.status === 'open' && seatsTaken(room) > 0) {
      out.push(withTimer(room));
      await write(room).catch(() => {});
    }
  }
  return out.sort((a, b) => seatsTaken(b) - seatsTaken(a));
}

export function sharedEnabled() {
  return isDbConfigured();
}
