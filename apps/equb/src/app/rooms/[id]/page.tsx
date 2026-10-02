'use client';

import { useEffect, useState } from 'react';
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
import { optimisticJoin } from '@/lib/optimistic';
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

  const templateId = id?.match(/^equb-\d+-\d+/)?.[0] || id;

  useEffect(() => {
    if (!multiplayer) {
      ensureRooms();
      return;
    }
    let stop = false;
    const tick = async () => {
      try {
        if (serverRoom?.id) {
          const r = await fetchRoom(serverRoom.id);
          if (!stop) setServerRoom(r);
        } else {
          const r = await openRoom(templateId!);
          if (!stop) setServerRoom(r);
        }
      } catch {
        /* offline */
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 2500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [multiplayer, ensureRooms, templateId, serverRoom?.id]);

  if (multiplayer) {
    const room = serverRoom;
    const identity = getPlayerIdentity();
    const taken = new Set(room?.members.map((m) => m.pick) || []);
    const inRoom = !!room?.members.some((m) => m.playerId === identity.playerId);
    const full = room ? room.members.length >= room.groupSize : false;
    const winner = room?.members.find((m) => m.playerId === room.winnerId);

    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="text-sm text-white/50">← Rooms</button>
        <div className="rounded-xl border border-equb-500/30 bg-equb-500/10 px-3 py-2 text-xs text-equb-300">
          LIVE multiplayer
        </div>
        {!room ? (
          <p className="text-center text-white/50">Connecting…</p>
        ) : (
          <div className="glass rounded-3xl p-5">
            <h1 className="text-2xl font-bold">
              {room.groupSize} · {room.prizePool.toLocaleString()} Birr
            </h1>
            <p className="text-sm text-white/60">
              {room.members.length}/{room.groupSize} · entry {room.contribution}
            </p>
            {room.status === 'completed' && room.winningNumber != null && (
              <div className="mt-4 text-center">
                <p className="text-5xl font-black text-gold-400">{room.winningNumber}</p>
                <p className="text-sm">Winner: {winner?.name}</p>
              </div>
            )}
            {msg && <p className="mt-2 text-xs text-equb-300">{msg}</p>}
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
                        pick === n && 'ring-2 ring-equb-400 bg-equb-500/30',
                        taken.has(n) && 'opacity-30',
                        !taken.has(n) && 'bg-white/10',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {!inRoom && (
                  <button
                    disabled={pick == null || joining}
                    onClick={async () => {
                      if (pick == null) return;
                      setJoining(true);
                      setServerRoom(optimisticJoin(room, pick));
                      try {
                        setServerRoom(await mpJoin(templateId!, pick));
                        setMsg(`Joined #${pick}`);
                      } catch (e: any) {
                        setMsg(e?.message || 'Join failed');
                      } finally {
                        setJoining(false);
                      }
                    }}
                    className="mt-4 w-full rounded-2xl bg-equb-500 py-3 font-bold disabled:opacity-40"
                  >
                    {joining ? 'Joining…' : 'Join live'}
                  </button>
                )}
                {inRoom && full && (
                  <button
                    disabled={drawing}
                    onClick={async () => {
                      setDrawing(true);
                      try {
                        setServerRoom(await drawRoom(room.id));
                      } catch (e: any) {
                        setMsg(e?.message || 'Draw failed');
                      } finally {
                        setDrawing(false);
                      }
                    }}
                    className="mt-4 w-full rounded-2xl bg-gold-500 py-3 font-bold text-black"
                  >
                    {drawing ? 'Drawing…' : 'Server draw'}
                  </button>
                )}
              </>
            )}
          </div>
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
  const full = isFull(room);
  const winner = room.members.find((m) => m.id === room.winnerId);

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="text-sm text-white/50">← Rooms</button>
      <div className="rounded-xl border border-equb-500/25 bg-equb-500/10 px-3 py-2 text-xs text-equb-200">
        Solo demo — bots on this device
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
        {msg && <p className="mt-2 text-xs text-equb-300">{msg}</p>}
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
                    pick === n && 'ring-2 ring-equb-400',
                    taken.has(n) && 'opacity-30',
                    !taken.has(n) && 'bg-white/10',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              {!user && (
                <button onClick={() => loginDemo()} className="w-full rounded-2xl bg-equb-600 py-3 font-bold">
                  Sign in (demo)
                </button>
              )}
              {user && !inRoom && (
                <button
                  disabled={pick == null}
                  onClick={() => pick != null && setMsg(joinLocal(room.id, pick).message)}
                  className="w-full rounded-2xl bg-equb-500 py-3 font-bold disabled:opacity-40"
                >
                  Join · pick number
                </button>
              )}
              {inRoom && !full && (
                <button
                  onClick={() => setMsg(fillSeats(room.id).message)}
                  className="w-full rounded-2xl border border-equb-500/40 py-3 text-equb-300"
                >
                  Fill seats with bots
                </button>
              )}
              {inRoom && full && (
                <button
                  disabled={drawing}
                  onClick={async () => {
                    setDrawing(true);
                    setMsg((await runDraw(room.id)).message);
                    setDrawing(false);
                  }}
                  className="w-full rounded-2xl bg-gold-500 py-3 font-bold text-black"
                >
                  {drawing ? 'Drawing…' : 'Crypto draw'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
