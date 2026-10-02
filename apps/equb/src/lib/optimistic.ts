import type { ServerRoom } from './multiplayer';
import { getPlayerIdentity } from './multiplayer';

export function optimisticJoin(room: ServerRoom, pick: number): ServerRoom {
  const { playerId, name } = getPlayerIdentity();
  if (room.members.some((m) => m.playerId === playerId)) return room;
  if (room.members.some((m) => m.pick === pick)) return room;
  if (room.members.length >= room.groupSize) return room;
  return {
    ...room,
    members: [...room.members, { playerId, name, pick, joinedAt: Date.now() }],
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
    return { ...next, members: [...byId.values()].sort((a, b) => a.pick - b.pick) };
  }
  return next;
}
