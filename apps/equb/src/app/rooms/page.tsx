'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { GROUP_SIZES, seatsLeft } from '@/lib/equb-math';
import clsx from 'clsx';

export default function RoomsPage() {
  const rooms = useEqubStore((s) => s.rooms);
  const ensureRooms = useEqubStore((s) => s.ensureRooms);
  const user = useEqubStore((s) => s.user);
  const [sizeFilter, setSizeFilter] = useState<number | 'all'>('all');
  const [tier, setTier] = useState<'all' | 'entry' | 'low' | 'mid' | 'high'>('all');

  useEffect(() => {
    ensureRooms();
  }, [ensureRooms]);

  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      if (sizeFilter !== 'all' && r.groupSize !== sizeFilter) return false;
      if (tier !== 'all' && r.tier !== tier) return false;
      return true;
    });
  }, [rooms, sizeFilter, tier]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Rooms</h1>
        <p className="text-sm text-white/50">Join a group · pay contribution · receive in turn</p>
      </div>
      {!user && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Sign in from Profile to join rooms with virtual Birr.
        </p>
      )}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSizeFilter('all')}
          className={clsx(
            'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
            sizeFilter === 'all' ? 'bg-equb-500 text-white' : 'bg-white/5 text-white/60',
          )}
        >
          All sizes
        </button>
        {GROUP_SIZES.map((s) => (
          <button
            key={s}
            onClick={() => setSizeFilter(s)}
            className={clsx(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
              sizeFilter === s ? 'bg-equb-500 text-white' : 'bg-white/5 text-white/60',
            )}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        {(['all', 'entry', 'low'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={clsx(
              'rounded-full px-3 py-1 text-xs capitalize',
              tier === t ? 'bg-gold-500/20 text-gold-400' : 'bg-white/5 text-white/50',
            )}
          >
            {t === 'all' ? 'All tiers' : t}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.slice(0, 40).map((r) => {
          const left = seatsLeft(r);
          return (
            <Link
              key={r.id}
              href={`/rooms/${r.id}`}
              className="glass block rounded-2xl p-4 transition hover:border-equb-500/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {r.groupSize} players · {r.prizePool.toLocaleString()} Birr
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">
                    Pay <span className="text-equb-400">{r.contribution}</span> each · {r.tier} tier
                  </p>
                </div>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                    r.status === 'open' && 'bg-equb-500/20 text-equb-400',
                    r.status === 'active' && 'bg-gold-500/20 text-gold-400',
                    r.status === 'completed' && 'bg-white/10 text-white/40',
                  )}
                >
                  {r.status}
                </span>
              </div>
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-equb-500"
                    style={{ width: `${(r.members.length / r.groupSize) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-white/40">
                  {r.members.length}/{r.groupSize} seats
                  {r.status === 'open' ? ` · ${left} left` : ''}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
