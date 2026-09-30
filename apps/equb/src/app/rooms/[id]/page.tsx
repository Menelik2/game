'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { seatsLeft } from '@/lib/equb-math';

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const rooms = useEqubStore((s) => s.rooms);
  const ensureRooms = useEqubStore((s) => s.ensureRooms);
  const user = useEqubStore((s) => s.user);
  const joinRoom = useEqubStore((s) => s.joinRoom);
  const fillSeats = useEqubStore((s) => s.fillSeats);
  const advanceRound = useEqubStore((s) => s.advanceRound);
  const finishCycle = useEqubStore((s) => s.finishCycle);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    ensureRooms();
  }, [ensureRooms]);

  const room = rooms.find((r) => r.id === id);
  if (!room) {
    return (
      <div className="py-12 text-center text-white/50">
        Room not found.{' '}
        <Link href="/rooms" className="text-equb-400">
          Back
        </Link>
      </div>
    );
  }

  const sorted = [...room.members].sort((a, b) => a.position - b.position);
  const inRoom = !!(user && room.members.some((m) => m.id === user.id));
  const nextUp = sorted.find((m) => !m.hasReceived);
  const receivedCount = room.members.filter((m) => m.hasReceived).length;

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="text-sm text-white/50">
        ← Rooms
      </button>

      <div className="glass rounded-3xl p-5">
        <p className="text-xs uppercase tracking-wide text-equb-400">{room.tier} tier</p>
        <h1 className="mt-1 text-2xl font-bold">
          {room.groupSize} players · {room.prizePool.toLocaleString()} Birr
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Each pays <strong className="text-white">{room.contribution} Birr</strong>
          {' '}({room.prizePool} ÷ {room.groupSize})
        </p>
        <p className="mt-1 text-xs text-white/40">
          Status: {room.status} · {room.members.length}/{room.groupSize}
          {room.status === 'open' ? ` · ${seatsLeft(room)} left` : ''}
          {room.status === 'active' ? ` · ${receivedCount}/${room.groupSize} paid out` : ''}
        </p>

        {nextUp && room.status === 'active' && (
          <p className="mt-3 rounded-xl bg-gold-500/10 px-3 py-2 text-sm text-gold-400">
            Next: <strong>#{nextUp.position} {nextUp.name}</strong>
            {user?.id === nextUp.id ? ' (you)' : ''}
          </p>
        )}

        {msg && (
          <p className="mt-3 rounded-xl bg-equb-500/15 px-3 py-2 text-xs text-equb-300">{msg}</p>
        )}

        {room.status === 'open' && (
          <div className="mt-5 space-y-2">
            <button
              disabled={!user || inRoom}
              onClick={() => setMsg(joinRoom(room.id).message)}
              className="w-full rounded-2xl bg-gradient-to-r from-equb-500 to-equb-600 py-3.5 text-sm font-bold disabled:opacity-40"
            >
              {inRoom ? 'Already joined' : user ? `1. Join · pay ${room.contribution} Birr` : 'Sign in to join'}
            </button>
            {inRoom && seatsLeft(room) > 0 && (
              <button
                onClick={() => setMsg(fillSeats(room.id).message)}
                className="w-full rounded-2xl border border-equb-500/40 bg-equb-500/10 py-3.5 text-sm font-bold text-equb-300"
              >
                2. Fill remaining seats (demo players)
              </button>
            )}
          </div>
        )}

        {room.status === 'active' && inRoom && (
          <div className="mt-5 space-y-2">
            <button
              onClick={() => setMsg(advanceRound(room.id).message)}
              className="w-full rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 py-3.5 text-sm font-bold text-black"
            >
              Next payout
            </button>
            <button
              onClick={() => setMsg(finishCycle(room.id).message)}
              className="w-full rounded-2xl border border-white/15 py-3 text-sm text-white/70"
            >
              Run full cycle
            </button>
          </div>
        )}

        {room.status === 'completed' && (
          <p className="mt-5 text-center text-sm text-equb-400">
            Cycle complete. Everyone received once.
          </p>
        )}
      </div>

      {sorted.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-bold">Rotation order</h2>
          <ul className="mt-3 space-y-2">
            {sorted.map((m) => (
              <li
                key={m.id}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                  nextUp?.id === m.id && !m.hasReceived
                    ? 'bg-gold-500/15 ring-1 ring-gold-500/30'
                    : 'bg-black/30'
                }`}
              >
                <span>
                  <span className="mr-2 font-mono text-equb-400">#{m.position}</span>
                  {m.name}
                  {user?.id === m.id ? ' (you)' : ''}
                </span>
                <span className="text-xs text-white/40">
                  {m.hasReceived ? 'Received' : nextUp?.id === m.id ? 'Next' : 'Waiting'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 p-4 text-xs text-white/45">
        <p className="font-semibold text-white/70">How to play</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Sign in → 5,000 virtual Birr</li>
          <li>Join room (pays contribution)</li>
          <li>Fill seats with demo players</li>
          <li>Next payout until everyone received</li>
        </ol>
      </div>
    </div>
  );
}
