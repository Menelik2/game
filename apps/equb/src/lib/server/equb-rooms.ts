import { randomBytes, createHash } from 'crypto';

const ROUND_MS = 60_000;
const GROUP_SIZES = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export type Member = {
  playerId: string;
  name: string;
  pick: number;
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
  entropyHex: string | null;
  commitmentHash: string | null;
  drawAt: number;
  secondsLeft: number;
  createdAt: number;
  updatedAt: number;
};

const g = globalThis as unknown as { __equbRooms?: Map<string, Room> };
if (!g.__equbRooms) g.__equbRooms = new Map();
const rooms = g.__equbRooms;

function contributionOf(prizePool: number, groupSize: number) {
  return Math.round((prizePool / groupSize) * 100) / 100;
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

function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
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

export function withTimer(room: Room): Room {
  const secondsLeft = Math.max(0, Math.ceil((room.drawAt - Date.now()) / 1000));
  return { ...room, secondsLeft };
}

function createRoom(templateId: string): Room {
  const match = /^equb-(\d+)-(\d+)$/.exec(templateId);
  if (!match) throw new Error('Invalid room template');
  const groupSize = parseInt(match[1], 10);
  const prizePool = parseInt(match[2], 10);
  if (!GROUP_SIZES.includes(groupSize) || prizePool <= 0) {
    throw new Error('Invalid room size or prize');
  }
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
    entropyHex: null,
    commitmentHash: null,
    drawAt: now + ROUND_MS,
    secondsLeft: Math.ceil(ROUND_MS / 1000),
    createdAt: now,
    updatedAt: now,
  };
  rooms.set(room.id, room);
  return room;
}

export function findOpen(templateId: string): Room | undefined {
  for (const r of rooms.values()) {
    if (r.templateId === templateId && r.status === 'open') return r;
  }
  return undefined;
}

export function ensureOpen(templateId: string): Room {
  const existing = findOpen(templateId);
  if (existing) {
    const drawn = maybeDraw(existing);
    if (drawn.status === 'open') return withTimer(drawn);
  }
  return withTimer(createRoom(templateId));
}

export function getRoom(id: string): Room | undefined {
  const r = rooms.get(id);
  if (!r) return undefined;
  return maybeDraw(r);
}

export function maybeDraw(room: Room): Room {
  if (room.status === 'completed' || room.status === 'drawing') {
    return withTimer(room);
  }
  if (room.status !== 'open') return withTimer(room);
  if (Date.now() < room.drawAt) return withTimer(room);

  if (room.members.length < 1) {
    room.drawAt = Date.now() + ROUND_MS;
    room.updatedAt = Date.now();
    rooms.set(room.id, room);
    return withTimer(room);
  }

  room.status = 'drawing';
  rooms.set(room.id, room);

  const picks = room.members.map((m) => m.pick);
  let proof = cryptoDraw(room.groupSize);

  if (!picks.includes(proof.winningNumber)) {
    for (let i = 0; i < 48; i++) {
      proof = cryptoDraw(room.groupSize);
      if (picks.includes(proof.winningNumber)) break;
    }
    if (!picks.includes(proof.winningNumber)) {
      proof.winningNumber = picks[secureRandomInt(picks.length)]!;
      proof.commitmentHash = createHash('sha256')
        .update(`${proof.entropyHex}:${room.groupSize}:${proof.winningNumber}`)
        .digest('hex');
    }
  }

  const winner = room.members.find((m) => m.pick === proof.winningNumber);
  room.status = 'completed';
  room.winningNumber = proof.winningNumber;
  room.winnerId = winner?.playerId ?? null;
  room.winnerName = winner?.name ?? null;
  room.entropyHex = proof.entropyHex;
  room.commitmentHash = proof.commitmentHash;
  room.updatedAt = Date.now();
  rooms.set(room.id, room);
  return withTimer(room);
}

export function joinRoom(
  templateId: string,
  playerId: string,
  name: string,
  pick: number,
): Room {
  let room = ensureOpen(templateId);
  room = maybeDraw(room);

  if (room.status !== 'open') {
    room = withTimer(createRoom(templateId));
  }

  if (room.members.some((m) => m.playerId === playerId)) {
    throw new Error('Already in this room');
  }
  if (!Number.isFinite(pick) || pick < 1 || pick > room.groupSize) {
    throw new Error(`Pick a number from 1 to ${room.groupSize}`);
  }
  if (room.members.some((m) => m.pick === pick)) {
    throw new Error('Number already taken');
  }
  if (room.members.length >= room.groupSize) {
    throw new Error('Room is full — wait for next round');
  }

  room.members.push({
    playerId,
    name: (name || 'Player').slice(0, 40),
    pick: Math.floor(pick),
    joinedAt: Date.now(),
  });
  room.updatedAt = Date.now();
  rooms.set(room.id, room);
  return withTimer(room);
}

export function listRooms(): Room[] {
  return [...rooms.values()].map((r) => withTimer(maybeDraw({ ...r })));
}
