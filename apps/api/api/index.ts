/**
 * Vercel serverless API — Equb rooms + real-time wallet balances
 * Root Directory: apps/api
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomBytes, createHash } from 'crypto';

const ROUND_MS = 60_000;
const STARTING_BALANCE = 5000;
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

type Wallet = {
  playerId: string;
  balance: number;
  updatedAt: number;
  version: number;
};

type BalanceEvent = {
  playerId: string;
  balance: number;
  delta: number;
  reason: string;
  at: number;
  version: number;
};

const g = globalThis as unknown as {
  __equbRooms?: Map<string, Room>;
  __equbWallets?: Map<string, Wallet>;
  __equbBalListeners?: Map<string, Set<(e: BalanceEvent) => void>>;
};

if (!g.__equbRooms) g.__equbRooms = new Map();
if (!g.__equbWallets) g.__equbWallets = new Map();
if (!g.__equbBalListeners) g.__equbBalListeners = new Map();

const rooms = g.__equbRooms;
const wallets = g.__equbWallets;
const listeners = g.__equbBalListeners;

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

function ensureWallet(playerId: string): Wallet {
  let w = wallets.get(playerId);
  if (!w) {
    w = {
      playerId,
      balance: STARTING_BALANCE,
      updatedAt: Date.now(),
      version: 1,
    };
    wallets.set(playerId, w);
  }
  return w;
}

function notifyBalance(ev: BalanceEvent) {
  const set = listeners.get(ev.playerId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(ev);
    } catch {
      /* ignore */
    }
  }
}

function applyDelta(playerId: string, delta: number, reason: string): Wallet {
  const w = ensureWallet(playerId);
  const next = Math.max(0, Math.round((w.balance + delta) * 100) / 100);
  w.balance = next;
  w.updatedAt = Date.now();
  w.version += 1;
  wallets.set(playerId, w);
  notifyBalance({
    playerId,
    balance: next,
    delta,
    reason,
    at: w.updatedAt,
    version: w.version,
  });
  return { ...w };
}

function setBalance(playerId: string, balance: number, reason = 'set'): Wallet {
  const w = ensureWallet(playerId);
  const next = Math.max(0, Math.round(balance * 100) / 100);
  const delta = next - w.balance;
  w.balance = next;
  w.updatedAt = Date.now();
  w.version += 1;
  wallets.set(playerId, w);
  notifyBalance({
    playerId,
    balance: next,
    delta,
    reason,
    at: w.updatedAt,
    version: w.version,
  });
  return { ...w };
}

function subscribe(playerId: string, fn: (e: BalanceEvent) => void) {
  let set = listeners.get(playerId);
  if (!set) {
    set = new Set();
    listeners.set(playerId, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
  };
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
  if (winner) {
    const payout = Math.round(room.prizePool * 0.9 * 100) / 100;
    applyDelta(winner.playerId, payout, `win:${room.id}`);
  }
  return withTimer(room);
}

function join(
  templateId: string,
  playerId: string,
  name: string,
  pick: number,
): { room: Room; wallet: Wallet } {
  let room = ensureOpen(templateId);
  room = maybeDraw(room);
  if (room.status !== 'open') room = ensureOpen(templateId);
  if (room.members.some((m) => m.playerId === playerId)) {
    throw new Error('Already in this room');
  }
  if (pick < 1 || pick > room.groupSize) throw new Error('Invalid pick');
  if (room.members.some((m) => m.pick === pick)) throw new Error('Number taken');
  if (room.members.length >= room.groupSize) throw new Error('Room full');

  const wallet = ensureWallet(playerId);
  if (wallet.balance < room.contribution) {
    throw new Error(
      `Insufficient balance: need ${room.contribution}, have ${wallet.balance}`,
    );
  }
  const afterDebit = applyDelta(playerId, -room.contribution, `bet:${templateId}`);

  room.members.push({
    playerId,
    name: (name || 'Player').slice(0, 40),
    pick,
    joinedAt: Date.now(),
  });
  room.updatedAt = Date.now();
  rooms.set(room.id, room);
  return { room: withTimer(room), wallet: afterDebit };
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
        wallet: true,
        realtimeBalance: true,
        timestamp: new Date().toISOString(),
        wallets: wallets.size,
        rooms: rooms.size,
      });
      return;
    }

    const getW = path.match(/^\/api\/wallet\/([^/]+)$/);
    if (getW && req.method === 'GET' && !path.endsWith('/stream')) {
      const playerId = decodeURIComponent(getW[1]!);
      if (playerId === 'debit' || playerId === 'credit' || playerId === 'ensure' || playerId === 'set') {
        /* fall through to other routes */
      } else {
        const w = ensureWallet(playerId);
        res.status(200).json(ok(w));
        return;
      }
    }

    if (path === '/api/wallet/ensure' && req.method === 'POST') {
      const body = await readBody(req);
      const playerId = String(body.playerId || '');
      if (!playerId) {
        res.status(400).json({ success: false, message: 'playerId required' });
        return;
      }
      res.status(200).json(ok(ensureWallet(playerId)));
      return;
    }

    if (path === '/api/wallet/debit' && req.method === 'POST') {
      const body = await readBody(req);
      const playerId = String(body.playerId || '');
      const amount = Number(body.amount);
      const reason = String(body.reason || 'debit');
      if (!playerId || !Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ success: false, message: 'playerId and positive amount required' });
        return;
      }
      const w = ensureWallet(playerId);
      if (w.balance < amount) {
        res.status(400).json({
          success: false,
          message: `Insufficient balance: need ${amount}, have ${w.balance}`,
          data: w,
        });
        return;
      }
      res.status(200).json(ok(applyDelta(playerId, -amount, reason)));
      return;
    }

    if (path === '/api/wallet/credit' && req.method === 'POST') {
      const body = await readBody(req);
      const playerId = String(body.playerId || '');
      const amount = Number(body.amount);
      const reason = String(body.reason || 'credit');
      if (!playerId || !Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({ success: false, message: 'playerId and positive amount required' });
        return;
      }
      res.status(200).json(ok(applyDelta(playerId, amount, reason)));
      return;
    }

    if (path === '/api/wallet/set' && req.method === 'POST') {
      const body = await readBody(req);
      const playerId = String(body.playerId || '');
      const balance = Number(body.balance);
      if (!playerId || !Number.isFinite(balance) || balance < 0) {
        res.status(400).json({ success: false, message: 'playerId and balance >= 0 required' });
        return;
      }
      res.status(200).json(ok(setBalance(playerId, balance, 'admin_set')));
      return;
    }

    const streamM = path.match(/^\/api\/wallet\/([^/]+)\/stream$/);
    if (streamM && req.method === 'GET') {
      const playerId = decodeURIComponent(streamM[1]!);
      const w = ensureWallet(playerId);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      const send = (ev: unknown) => {
        res.write(`data: ${JSON.stringify(ev)}\n\n`);
      };
      send({ type: 'snapshot', data: w });
      const unsub = subscribe(playerId, (ev) => {
        try {
          send(ev);
        } catch {
          unsub();
        }
      });
      const hb = setInterval(() => {
        try {
          res.write(`: ping ${Date.now()}\n\n`);
        } catch {
          clearInterval(hb);
          unsub();
        }
      }, 15000);
      req.on?.('close', () => {
        clearInterval(hb);
        unsub();
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
      res.status(200).json(ok([...rooms.values()].map((r) => withTimer(maybeDraw(r)))));
      return;
    }

    const getRoom = path.match(/^\/api\/equb\/rooms\/([^/]+)$/);
    if (getRoom && req.method === 'GET') {
      const id = decodeURIComponent(getRoom[1]!);
      let room = rooms.get(id);
      if (!room) {
        if (/^equb-\d+-\d+$/.test(id)) room = ensureOpen(id);
        else {
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
      res.status(200).json(ok(withTimer(ensureOpen(decodeURIComponent(openM[1]!)))));
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
        res.status(400).json({ success: false, message: 'playerId and pick required' });
        return;
      }
      try {
        const { room, wallet } = join(templateId, playerId, name, pick);
        res.status(200).json(ok({ ...room, wallet }));
      } catch (e: any) {
        res.status(400).json({ success: false, message: e?.message || 'Join failed' });
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
      hint: 'GET /api/wallet/:id · GET /api/wallet/:id/stream · POST /api/wallet/debit',
    });
  } catch (e: any) {
    res.status(500).json({ success: false, message: e?.message || 'Internal error' });
  }
}
