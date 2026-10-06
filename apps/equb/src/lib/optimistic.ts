import type { ServerRoom } from './multiplayer';
import { getPlayerIdentity } from './multiplayer';

export function optimisticJoin(
  room: ServerRoom,
  pickOrPicks: number | number[],
): ServerRoom {
  const { playerId, name } = getPlayerIdentity();
  if (room.members.some((m) => m.playerId === playerId)) return room;

  const picks = (
    Array.isArray(pickOrPicks) ? pickOrPicks : [pickOrPicks]
  )
    .map((n) => Math.floor(Number(n)))
    .filter((n) => n >= 1 && n <= room.groupSize);

  if (picks.length === 0) return room;

  const taken = new Set<
    number
  >();
  for (const m of room.members) {
    const list = m.picks?.length ? m.picks : [m.pick];
    for (const p of list) taken.add(p);
  }
  for (const p of picks) {
    if (taken.has(p)) return room;
  }

  return {
    ...room,
    members: [
      ...room.members,
      {
        playerId,
        name,
        pick: picks[0]!,
        picks,
        joinedAt: Date.now(),
      },
    ],
    updatedAt: Date.now(),
  };
}

export function mergeRoomState(
  prev: ServerRoom | null,
  next: ServerRoom,
  opts?: { pendingPlayerId?: string | null },
): ServerRoom {
  if (!prev || prev.id !== next.id) return next;
  if (!opts?.pendingPlayerId) return next;
  const missing = !next.members.some((m) => m.playerId === opts.pendingPlayerId);
  if (missing && prev.members.length >= next.members.length) {
    const byId = new Map(next.members.map((m) => [m.playerId, m]));
    for (const m of prev.members) if (!byId.has(m.playerId)) byId.set(m.playerId, m);
    return {
      ...next,
      members: [...byId.values()].sort((a, b) => a.pick - b.pick),
    };
  }
  return next;
}
