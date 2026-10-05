import { randomBytes, createHash } from 'crypto';
import { isDbConfigured } from './db-users';
import { createClient } from '@supabase/supabase-js';

const ROUND_MS = 60_000;
export type Member = { playerId: string; name: string; pick: number; joinedAt: number };
export type SharedRoom = {
  id: string; templateId: string; groupSize: number; prizePool: number; contribution: number;
  status: 'open' | 'completed'; members: Member[]; winningNumber: number | null;
  winnerId: string | null; winnerName: string | null; entropyHex: string | null;
  commitmentHash: string | null; drawAt: number; secondsLeft: number; updatedAt: number;
};

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  return createClient(url, key, { auth: { persistSession: false } });
}
function withTimer(room: SharedRoom): SharedRoom {
  return { ...room, secondsLeft: Math.max(0, Math.ceil((room.drawAt - Date.now()) / 1000)) };
}
function fresh(templateId: string): SharedRoom {
  const m = /^equb-(\d+)-(\d+)$/.exec(templateId);
  if (!m) throw new Error('Invalid room');
  const groupSize = Number(m[1]);
  const prizePool = Number(m[2]);
  const now = Date.now();
  return {
    id: `${templateId}-${now.toString(36)}`, templateId, groupSize, prizePool,
    contribution: Math.round((prizePool / groupSize) * 100) / 100, status: 'open', members: [],
    winningNumber: null, winnerId: null, winnerName: null, entropyHex: null, commitmentHash: null,
    drawAt: now + ROUND_MS, secondsLeft: 60, updatedAt: now,
  };
}
async function read(templateId: string): Promise<SharedRoom | null> {
  if (!isDbConfigured()) return null;
  const { data, error } = await sb().from('equb_live_rooms').select('payload').eq('template_id', templateId).maybeSingle();
  if (error || !data?.payload) return null;
  return data.payload as SharedRoom;
}
async function write(room: SharedRoom) {
  if (!isDbConfigured()) return;
  const { error } = await sb().from('equb_live_rooms').upsert({ template_id: room.templateId, payload: room, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
function draw(room: SharedRoom): SharedRoom {
  if (room.status !== 'open' || Date.now() < room.drawAt) return withTimer(room);
  if (room.members.length < 1) { room.drawAt = Date.now() + ROUND_MS; return withTimer(room); }
  const entropy = randomBytes(32);
  const entropyHex = entropy.toString('hex');
  let winningNumber = (entropy.readUInt32BE(0) % room.groupSize) + 1;
  const picks = room.members.map((m) => m.pick);
  if (!picks.includes(winningNumber)) winningNumber = picks[entropy.readUInt8(4) % picks.length];
  const winner = room.members.find((m) => m.pick === winningNumber);
  room.status = 'completed';
  room.winningNumber = winningNumber;
  room.winnerId = winner?.playerId ?? null;
  room.winnerName = winner?.name ?? null;
  room.entropyHex = entropyHex;
  room.commitmentHash = createHash('sha256').update(`${entropyHex}:${winningNumber}`).digest('hex');
  room.updatedAt = Date.now();
  return withTimer(room);
}
export async function openShared(templateId: string) {
  let room = await read(templateId);
  if (!room || room.status === 'completed') room = fresh(templateId);
  else room = draw(room);
  if (room.status === 'completed') room = fresh(templateId);
  await write(room);
  return withTimer(room);
}
export async function getShared(templateId: string) {
  let room = await read(templateId);
  if (!room) room = fresh(templateId);
  room = draw(room);
  await write(room);
  return withTimer(room);
}
export async function joinShared(templateId: string, playerId: string, name: string, pick: number) {
  let room = await read(templateId);
  if (!room) room = fresh(templateId);
  room = draw(room);
  if (room.status !== 'open') room = fresh(templateId);
  if (room.members.some((m) => m.playerId === playerId)) throw new Error('Already in this room');
  if (pick < 1 || pick > room.groupSize) throw new Error('Invalid number');
  if (room.members.some((m) => m.pick === pick)) throw new Error('Number taken');
  if (room.members.length >= room.groupSize) throw new Error('Room full');
  room.members.push({ playerId, name: name.slice(0, 40), pick, joinedAt: Date.now() });
  room.updatedAt = Date.now();
  await write(room);
  return withTimer(room);
}
export function sharedEnabled() { return isDbConfigured(); }
