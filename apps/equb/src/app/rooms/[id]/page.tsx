'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { numberPool, takenPicks, isFull } from '@/lib/equb-math';
import {
  isMultiplayerEnabled,
  joinRoom as mpJoin,
  openRoom,
  fetchRoom,
  drawRoom,
  getPlayerIdentity,
  type ServerRoom,
} from '@/lib/multiplayer';
import { optimisticJoin, mergeRoomState } from '@/lib/optimistic';
import clsx from 'clsx';

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const multiplayer = isMultiplayerEnabled();

  const rooms = useEqubStore((s) => s.rooms);
  const ensureRooms = useEqubStore((s) => s.ensureRooms);
  const user = useEqubStore((s) => s.user);
  const joinLocal = useEqubStore((s) => s.joinRoom);
  const fillSeats = useEqubStore((s) => s.fillSeats);
  const runDraw = useEqubStore((s) => s.runDraw);
  const loginDemo = useEqubStore((s) => s.loginDemo);

  const [msg, setMsg] = useState('');
  const [pick, setPick] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [serverRoom, setServerRoom] = useState<ServerRoom | null>(null);
  const [pollError, setPollError] = useState('');
  const [optimistic, setOptimistic] = useState(false);

  const pendingPlayerId = useRef<string | null>(null);
  const snapshotRef = useRef<ServerRoom | null>(null);
  const templateId = id?.match(/^equb-\d+-\d+/)?.[0] || id;

  const refreshServer = useCallback(async () => {
    if (!multiplayer || !id) return;
    try {
      if (serverRoom?.id) {
        const r = await fetchRoom(serverRoom.id);
        setServerRoom((prev) =>
          mergeRoomState(prev, r, { pendingPlayerId: pendingPlayerId.current }),
        );
      } else {
        setServerRoom(await openRoom(templateId));
      }
      setPollError('');
    } catch (e: any) {
      setPollError(e?.message || 'API error');
    }
  }, [multiplayer, id, templateId, serverRoom?.id]);

  useEffect(() => {
    if (!multiplayer) {
      ensureRooms();
      return;
    }
    void refreshServer();
    const t = setInterval(() => void refreshServer(), 2500);
    return () => clearInterval(t);
  }, [multiplayer, ensureRooms, refreshServer]);

  async function handleLiveJoin(room: ServerRoom, selected: number) {
    if (joining) return;
    const identity = getPlayerIdentity();
    snapshotRef.current = room;
    pendingPlayerId.current = identity.playerId;
    setJoining(true);
    setOptimistic(true);
    setServerRoom(optimisticJoin(room, selected));
    setMsg(`Joining with #${selected}…`);
    try {
      const confirmed = await mpJoin(templateId, selected);
      setServerRoom(confirmed);
      setMsg(`Joined with #${selected}`);
      pendingPlayerId.current = null;
    } catch (e: any) {
      setServerRoom(snapshotRef.current);
      setMsg(e?.message || 'Join failed — rolled back');
      pendingPlayerId.current = null;
    } finally {
      setJoining(false);
      setOptimistic(false);
    }
  }

  async function handleLiveDraw(room: ServerRoom) {
    if (drawing) return;
    snapshotRef.current = room;
    setDrawing(true);
    setOptimistic(true);
    setMsg('Drawing…');
    try {
      const result = await drawRoom(room.id);
      setServerRoom(result);
      const identity = getPlayerIdentity();
      setMsg(
        result.winnerId === identity.playerId
          ? `You won! Number ${result.winningNumber}`
          : `Winner number ${result.winningNumber}`,
      );
    } catch (e: any) {
      setServerRoom(snapshotRef.current);
      setMsg(e?.message || 'Draw failed — rolled back');
    } finally {
      setDrawing(false);
      setOptimistic(false);
    }
  }

  if (multiplayer) {
    const room = serverRoom;
    const identity = getPlayerIdentity();
    const taken = new Set(room?.members.map((m) => m.pick) || []);
    const inRoom = !!room?.members.some((m) => m.playerId === identity.playerId);
    const myPick = room?.members.find((m) => m.playerId === identity.playerId)?.pick;
    const full = room ? room.members.length >= room.groupSize : false;
    const winner = room?.members.find((m) => m.playerId === room.winnerId);

    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="text-sm text-white/50">← Rooms</button>
        <div className="rounded-xl border border-equb-500/30 bg-equb-500/10 px-3 py-2 text-xs text-equb-300">
          LIVE · optimistic UI · server CSPRNG{optimistic ? ' · syncing…' : ''}
        </div>
        {pollError && <p className="text-xs text-red-300">{pollError}</p>}
        {!room ? (
          <p className="text-center text-white/50">Connecting…</p>
        ) : (
          <>
            <div className={clsx('glass rounded-3xl p-5', optimistic && 'opacity-90')}>
              <h1 className="text-2xl font-bold">
                {room.groupSize} players · {room.prizePool.toLocaleString()} Birr
              </h1>
              <p className="text-sm text-white/60">
                Entry {room.contribution} · {room.members.length}/{room.groupSize} joined
              </p>
              {room.status === 'completed' && room.winningNumber != null && (
                <div className="mt-4 rounded-2xl bg-gold-500/15 p-4 text-center">
                  <p className="text-5xl font-black text-gold-400">{room.winningNumber}</p>
                  <p className="mt-2 text-sm">
                    Winner: {winner?.name}
                    {winner?.playerId === identity.playerId ? ' (you)' : ''}
                  </p>
                </div>
              )}
              {msg && (
                <p className={clsx('mt-3 text-xs', optimistic ? 'text-white/70' : 'text-equb-300')}>
                  {msg}
                </p>
              )}
              {room.status === 'open' && (
                <>
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {Array.from({ length: room.groupSize }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        disabled={taken.has(n) || inRoom || joining}
                        onClick={() => setPick(n)}
                        className={clsx(
                          'aspect-square rounded-xl text-sm font-bold',
                          myPick === n && 'bg-equb-500',
                          pick === n && !inRoom && 'ring-2 ring-equb-400 bg-equb-500/30',
                          taken.has(n) && myPick !== n && 'opacity-30 line-through',
                          !taken.has(n) && 'bg-white/10',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    {!inRoom && (
                      <button
                        disabled={pick == null || joining}
                        onClick={() => pick != null && void handleLiveJoin(room, pick)}
                        className="w-full rounded-2xl bg-equb-500 py-3.5 text-sm font-bold disabled:opacity-40"
                      >
                        {joining ? 'Joining…' : pick == null ? 'Select number' : `Join live #${pick}`}
                      </button>
                    )}
                    {inRoom && full && (
                      <button
                        disabled={drawing}
                        onClick={() => void handleLiveDraw(room)}
                        className="w-full rounded-2xl bg-gold-500 py-3.5 text-sm font-bold text-black disabled:opacity-50"
                      >
                        {drawing ? 'Drawing…' : 'Server draw'}
                      </button>
                    )}
                    {inRoom && !full && (
                      <p className="text-center text-xs text-white/40">
                        Waiting for {room.groupSize - room.members.length} more players…
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            {room.members.length > 0 && (
              <div className="glass rounded-3xl p-5">
                <h2 className="font-bold">Live players</h2>
                <ul className="mt-3 space-y-2">
                  {[...room.members]
                    .sort((a, b) => a.pick - b.pick)
                    .map((m) => (
                      <li
                        key={m.playerId}
                        className={clsx(
                          'flex justify-between rounded-xl px-3 py-2 text-sm',
                          m.playerId === identity.playerId && joining
                            ? 'bg-equb-500/20 ring-1 ring-equb-500/40'
                            : 'bg-black/30',
                        )}
                      >
                        <span>
                          {m.name}
                          {m.playerId === identity.playerId ? ' (you)' : ''}
                          {m.playerId === identity.playerId && joining ? ' · pending' : ''}
                        </span>
                        <span className="font-mono text-equb-400">#{m.pick}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  const room = rooms.find((r) => r.id === id);
  if (!room) {
    return (
      <div className="py-12 text-center text-white/50">
        Room not found. <Link href="/rooms" className="text-equb-400">Back</Link>
      </div>
    );
  }
  const taken = takenPicks(room);
  const inRoom = !!(user && room.members.some((m) => m.id === user.id));
  const myPick = room.members.find((m) => m.id === user?.id)?.pick;
  const full = isFull(room);
  const winner = room.members.find((m) => m.id === room.winnerId);

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="text-sm text-white/50">← Rooms</button>
      <div className="rounded-xl border border-equb-500/25 bg-equb-500/10 px-3 py-2 text-xs text-equb-200">
        Solo demo — fully playable with bots on this device
      </div>
      <div className="glass rounded-3xl p-5">
        <h1 className="text-2xl font-bold">
          {room.groupSize} · {room.prizePool.toLocaleString()} Birr
        </h1>
        {room.status === 'completed' && (
          <div className="mt-4 text-center">
            <p className="text-5xl font-black text-gold-400">{room.winningNumber}</p>
            <p className="text-sm">Winner: {winner?.name}</p>
          </div>
        )}
        {msg && <p className="mt-3 text-xs text-equb-300">{msg}</p>}
        {room.status === 'open' && (
          <>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {numberPool(room.groupSize).map((n) => (
                <button
                  key={n}
                  disabled={taken.has(n) || inRoom}
                  onClick={() => setPick(n)}
                  className={clsx(
                    'aspect-square rounded-xl text-sm font-bold',
                    myPick === n && 'bg-equb-500',
                    pick === n && !inRoom && 'ring-2 ring-equb-400',
                    taken.has(n) && myPick !== n && 'opacity-30',
                    !taken.has(n) && 'bg-white/10',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {!user && (
                <button onClick={() => loginDemo()} className="w-full rounded-2xl bg-equb-600 py-3 text-sm font-bold">
                  Sign in (demo)
                </button>
              )}
              {user && !inRoom && (
                <button
                  disabled={pick == null}
                  onClick={() => pick != null && setMsg(joinLocal(room.id, pick).message)}
                  className="w-full rounded-2xl bg-equb-500 py-3 text-sm font-bold disabled:opacity-40"
                >
                  Join · pick number
                </button>
              )}
              {inRoom && !full && (
                <button
                  onClick={() => setMsg(fillSeats(room.id).message)}
                  className="w-full rounded-2xl border border-equb-500/40 py-3 text-sm text-equb-300"
                >
                  Fill seats with bots
                </button>
              )}
              {inRoom && full && (
                <button
                  disabled={drawing}
                  onClick={async () => {
                    setDrawing(true);
                    setMsg('Drawing…');
                    setMsg((await runDraw(room.id)).message);
                    setDrawing(false);
                  }}
                  className="w-full rounded-2xl bg-gold-500 py-3 text-sm font-bold text-black"
                >
                  {drawing ? 'Drawing…' : 'Crypto draw — one winner'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
