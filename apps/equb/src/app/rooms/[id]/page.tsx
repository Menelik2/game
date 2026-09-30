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
  const advanceRound = useEqubStore((s) => s.advanceRound);
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
  const inRoom = user && room.members.some((m) => m.id === user.id);

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
          Each contributes <strong className="text-white">{room.contribution} Birr</strong> (
          {room.prizePool} ÷ {room.groupSize})
        </p>
        <p className="mt-1 text-xs text-white/40">
          Status: {room.status} · {room.members.length}/{room.groupSize}
          {room.status === 'open' ? ` · ${seatsLeft(room)} left` : ''}
        </p>
        {msg && (
          <p className="mt-3 rounded-xl bg-equb-500/15 px-3 py-2 text-xs text-equb-300">{msg}</p>
        )}
        {room.status === 'open' && (
          <button
            disabled={!user}
            onClick={() => setMsg(joinRoom(room.id).message)}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-equb-500 to-equb-600 py-3.5 text-sm font-bold disabled:opacity-40"
          >
            {user ? `Join · pay ${room.contribution} Birr` : 'Sign in to join'}
          </button>
        )}
        {room.status === 'active' && inRoom && (
          <button
            onClick={() => setMsg(advanceRound(room.id).message)}
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-gold-500 to-gold-400 py-3.5 text-sm font-bold text-black"
          >
            Run next payout (demo)
          </button>
        )}
      </div>
      {sorted.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-bold">Rotation order</h2>
          <ul className="mt-3 space-y-2">
            {sorted.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2 text-sm"
              >
                <span>
                  <span className="mr-2 font-mono text-equb-400">#{m.position}</span>
                  {m.name}
                  {user?.id === m.id ? ' (you)' : ''}
                </span>
                <span className="text-xs text-white/40">
                  {m.hasReceived ? '✓ Received' : 'Waiting'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
