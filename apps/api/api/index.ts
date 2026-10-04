/**
 * Vercel serverless entry — pure Express-style handler (no Nest cold-start hang).
 * Root Directory on Vercel: apps/api
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, createHash } from 'crypto';

const ROUND_MS = 60_000;
const GROUP_SIZES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

type Member = { playerId: string; name: string; pick: number; joinedAt: number };
type Room = {
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
  entropyHex: string | null;
  commitmentHash: string | null;
  drawAt: number;
  secondsLeft: number;
  createdAt: number;
  updatedAt: number;
};

const rooms = new Map<string, Room>();

function contributionOf(prizePool: number, groupSize: number) {
  return Math.round((prizePool / groupSize) * 100) / 100;
}

function buildCatalog(maxPrize = 9000) {
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

function secureRandomInt(maxExclusive: number): number {
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  for (;;) {
    const x = randomBytes(4).readUInt32BE(0);
    if (x < limit) return x % maxExclusive;
  }
}

function cryptoDraw(groupSize: number) {
  const entropy = randomBytes(32);
  const entropyHex = entropy.toString('hex');
  const winningNumber = secureRandomInt(groupSize) + 1;
  const commitmentHash = createHash('sha256')
    .update(`${entropyHex}:${groupSize}:${winningNumber}`)
    .digest('hex');
  return { winningNumber, entropyHex, commitmentHash };
}

function withTimer(room: Room): Room {
  const secondsLeft = Math.max(0, Math.ceil((room.drawAt - Date.now()) / 1000));
  return { ...room, secondsLeft };
}

function findOpen(templateId: string): Room | undefined {
  for (const r of rooms.values()) {
    if (r.templateId === templateId && r.status === 'open') return r;
  }
  return undefined;
}

function ensureOpen(templateId: string): Room {
  const existing = findOpen(templateId);
  if (existing && existing.members.length < existing.groupSize) {
    return withTimer(existing);
  }
  const match = /^equb-(\d+)-(\d+)$/.exec(templateId);
  if (!match) throw new Error('Invalid room template');
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
    entropyHex: null,
    commitmentHash: null,
    drawAt: now + ROUND_MS,
    secondsLeft: Math.ceil(ROUND_MS / 1000),
    createdAt: now,
    updatedAt: now,
  };
  rooms.set(room.id, room);
  return withTimer(room);
}

function maybeDraw(room: Room): Room {
  if (room.status !== 'open') return withTimer(room);
  if (Date.now() < room.drawAt) return withTimer(room);
  if (room.members.length < 1) {
    room.drawAt = Date.now() + ROUND_MS;
    room.updatedAt = Date.now();
    return withTimer(room);
  }
  room.status = 'drawing';
  const picks = room.members.map((m) => m.pick);
  let proof = cryptoDraw(room.groupSize);
  if (!picks.includes(proof.winningNumber)) {
    for (let i = 0; i < 40; i++) {
      proof = cryptoDraw(room.groupSize);
      if (picks.includes(proof.winningNumber)) break;
    }
    if (!picks.includes(proof.winningNumber)) {
      proof.winningNumber = picks[secureRandomInt(picks.length)]!;
    }
  }
  const winner = room.members.find((m) => m.pick === proof.winningNumber);
  room.status = 'completed';
  room.winningNumber = proof.winningNumber;
  room.winnerId = winner?.playerId ?? null;
  room.entropyHex = proof.entropyHex;
  room.commitmentHash = proof.commitmentHash;
  room.updatedAt = Date.now();
  return withTimer(room);
}

function joinRoom(
  templateId: string,
  playerId: string,
  name: string,
  pick: number,
): Room {
  let room = ensureOpen(templateId);
  room = maybeDraw(room);
  if (room.status !== 'open') {
    room = ensureOpen(templateId);
  }
  if (room.members.some((m) => m.playerId === playerId)) {
    throw new Error('Already in this room');
  }
  if (pick < 1 || pick > room.groupSize) throw new Error('Invalid pick');
  if (room.members.some((m) => m.pick === pick)) throw new Error('Number taken');
  if (room.members.length >= room.groupSize) throw new Error('Room full');
  room.members.push({
    playerId,
    name: (name || 'Player').slice(0, 40),
    pick,
    joinedAt: Date.now(),
  });
  room.updatedAt = Date.now();
  rooms.set(room.id, room);
  return withTimer(room);
}

function cors(res: VercelResponse, origin?: string | string[]) {
  const o = Array.isArray(origin) ? origin[0] : origin;
  res.setHeader('Access-Control-Allow-Origin', o || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Request-Id, Accept, Origin',
  );
}

function ok(data: unknown) {
  return { success: true, data };
}

async function readBody(req: VercelRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  return {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const url = (req.url || '/').split('?')[0] || '/';
  const path = url.replace(/\/+$/, '') || '/';

  try {
    if (
      path === '/' ||
      path === '/api' ||
      path === '/health' ||
      path === '/api/health'
    ) {
      res.status(200).json({
        status: 'ok',
        service: 'fast-equb-api',
        equb: true,
        timestamp: new Date().toISOString(),
        demoMode: true,
        database: { configured: false, connected: false },
      });
      return;
    }

    if (path === '/api/equb/templates' && req.method === 'GET') {
      const catalog = buildCatalog(9000).map((t) => {
        const live = findOpen(t.id);
        return {
          ...t,
          liveRoomId: live?.id ?? null,
          seatsTaken: live?.members.length ?? 0,
          status: live?.status ?? 'open',
          secondsLeft: live ? withTimer(live).secondsLeft : 60,
        };
      });
      res.status(200).json(ok(catalog));
      return;
    }

    if (path === '/api/equb/rooms' && req.method === 'GET') {
      const list = [...rooms.values()].map((r) => withTimer(maybeDraw(r)));
      res.status(200).json(ok(list));
      return;
    }

    const getRoom = path.match(/^\/api\/equb\/rooms\/([^/]+)$/);
    if (getRoom && req.method === 'GET') {
      const id = decodeURIComponent(getRoom[1]!);
      let room = rooms.get(id);
      if (!room) {
        if (/^equb-\d+-\d+$/.test(id)) {
          room = ensureOpen(id);
        } else {
          res.status(404).json({ success: false, message: 'Room not found' });
          return;
        }
      }
      room = maybeDraw(room);
      rooms.set(room.id, room);
      res.status(200).json(ok(withTimer(room)));
      return;
    }

    const openM = path.match(/^\/api\/equb\/rooms\/([^/]+)\/open$/);
    if (openM && req.method === 'POST') {
      const templateId = decodeURIComponent(openM[1]!);
      const room = ensureOpen(templateId);
      res.status(200).json(ok(withTimer(room)));
      return;
    }

    const joinM = path.match(/^\/api\/equb\/rooms\/([^/]+)\/join$/);
    if (joinM && req.method === 'POST') {
      const templateId = decodeURIComponent(joinM[1]!);
      const body = await readBody(req);
      const playerId = String(body.playerId || '');
      const name = String(body.name || 'Player');
      const pick = Number(body.pick);
      if (!playerId || !Number.isFinite(pick)) {
        res
          .status(400)
          .json({ success: false, message: 'playerId and pick required' });
        return;
      }
      try {
        const room = joinRoom(templateId, playerId, name, pick);
        res.status(200).json(ok(room));
      } catch (e: any) {
        res
          .status(400)
          .json({ success: false, message: e?.message || 'Join failed' });
      }
      return;
    }

    const drawM = path.match(/^\/api\/equb\/rooms\/([^/]+)\/draw$/);
    if (drawM && req.method === 'POST') {
      const id = decodeURIComponent(drawM[1]!);
      const room = rooms.get(id);
      if (!room) {
        res.status(404).json({ success: false, message: 'Room not found' });
        return;
      }
      room.drawAt = 0;
      const drawn = maybeDraw(room);
      rooms.set(drawn.id, drawn);
      res.status(200).json(ok(drawn));
      return;
    }

    res.status(404).json({
      success: false,
      message: `Not found: ${path}`,
      hint: 'Try GET /api/health or GET /api/equb/templates',
    });
  } catch (e: any) {
    res.status(500).json({
      success: false,
      message: e?.message || 'Internal error',
    });
  }
}
