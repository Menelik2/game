'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { seatsLeft, numberPool, takenPicks, isFull } from '@/lib/equb-math';
import clsx from 'clsx';

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const rooms = useEqubStore((s) => s.rooms);
  const ensureRooms = useEqubStore((s) => s.ensureRooms);
  const user = useEqubStore((s) => s.user);
  const joinRoom = useEqubStore((s) => s.joinRoom);
  const fillSeats = useEqubStore((s) => s.fillSeats);
  const runDraw = useEqubStore((s) => s.runDraw);
  const [msg, setMsg] = useState('');
  const [pick, setPick] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    ensureRooms();
  }, [ensureRooms]);

  const room = rooms.find((r) => r.id === id);
  if (!room) {
    return (
      <div className="py-12 text-center text-white/50">
        Room not found.{' '}
        <Link href="/rooms" className="text-equb-400">Back</Link>
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

      <div className="glass rounded-3xl p-5">
        <p className="text-xs uppercase tracking-wide text-equb-400">{room.tier} tier</p>
        <h1 className="mt-1 text-2xl font-bold">
          {room.groupSize} players · {room.prizePool.toLocaleString()} Birr
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Entry <strong className="text-white">{room.contribution} Birr</strong>
          {' '}· pick a number · <strong>CSPRNG draw</strong> · one winner
        </p>
        <p className="mt-1 text-xs text-white/40">
          {room.members.length}/{room.groupSize} joined
          {room.status === 'open' && !full ? ` · ${seatsLeft(room)} left` : ''}
        </p>

        {room.status === 'completed' && room.winningNumber != null && (
          <div className="mt-4 rounded-2xl bg-gold-500/15 p-4 text-center ring-1 ring-gold-500/30">
            <p className="text-xs text-gold-400">Winning number (cryptographic)</p>
            <p className="mt-1 text-5xl font-black text-gold-400">{room.winningNumber}</p>
            <p className="mt-2 text-sm">
              Winner: <strong>{winner?.name}{winner?.id === user?.id ? ' (you)' : ''}</strong>
              {' · '}{room.prizePool.toLocaleString()} Birr
            </p>
            <p className="mt-2 text-[10px] text-white/35">
              Web Crypto getRandomValues · rejection sampling · SHA-256 proof
            </p>
          </div>
        )}

        {msg && (
          <p className="mt-3 rounded-xl bg-equb-500/15 px-3 py-2 text-xs text-equb-300">{msg}</p>
        )}

        {room.status === 'open' && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-white/50">
              {inRoom ? `Your number: ${myPick}` : `Select number (1–${room.groupSize})`}
            </p>
            <div className="grid grid-cols-5 gap-2">
              {numberPool(room.groupSize).map((n) => {
                const isTaken = taken.has(n);
                const isMine = myPick === n;
                const isSelected = pick === n && !inRoom;
                return (
                  <button
                    key={n}
                    disabled={isTaken || inRoom}
                    onClick={() => setPick(n)}
                    className={clsx(
                      'aspect-square rounded-xl text-sm font-bold transition',
                      isMine && 'bg-equb-500 text-white ring-2 ring-equb-300',
                      isSelected && 'bg-equb-500/40 text-white ring-2 ring-equb-400',
                      isTaken && !isMine && 'bg-white/5 text-white/25 line-through',
                      !isTaken && !isMine && !isSelected && 'bg-white/10 hover:bg-white/20',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {room.status === 'open' && (
          <div className="mt-5 space-y-2">
            {!inRoom && (
              <button
                disabled={!user || pick == null}
                onClick={() => pick != null && setMsg(joinRoom(room.id, pick).message)}
                className="w-full rounded-2xl bg-gradient-to-r from-equb-500 to-equb-600 py-3.5 text-sm font-bold disabled:opacity-40"
              >
                {!user ? 'Sign in to join' : pick == null ? 'Select a number' : `Join with #${pick} · pay ${room.contribution}`}
              </button>
            )}
            {inRoom && !full && (
              <button
                onClick={() => setMsg(fillSeats(room.id).message)}
                className="w-full rounded-2xl border border-equb-500/40 bg-equb-500/10 py-3.5 text-sm font-bold text-equb-300"
              >
                Fill empty seats (demo players)
              </button>
            )}
            {inRoom && full && (
              <button
                disabled={drawing}
                onClick={async () => {
                  setDrawing(true);
                  try {
                    const res = await runDraw(room.id);
                    setMsg(res.message);
                  } finally {
                    setDrawing(false);
                  }
                }}
                className="w-full rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 py-3.5 text-sm font-bold text-black disabled:opacity-50"
              >
                {drawing ? 'Drawing…' : 'Cryptographic draw — one winner'}
              </button>
            )}
          </div>
        )}
      </div>

      {room.members.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-bold">Players and numbers</h2>
          <ul className="mt-3 space-y-2">
            {[...room.members]
              .sort((a, b) => (a.pick ?? 0) - (b.pick ?? 0))
              .map((m) => (
                <li
                  key={m.id}
                  className={clsx(
                    'flex justify-between rounded-xl px-3 py-2 text-sm',
                    room.winnerId === m.id ? 'bg-gold-500/20 ring-1 ring-gold-500/40' : 'bg-black/30',
                  )}
                >
                  <span>
                    {m.name}{user?.id === m.id ? ' (you)' : ''}{m.isBot ? ' · demo' : ''}
                  </span>
                  <span className="font-mono font-bold text-equb-400">#{m.pick}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
