'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { GROUP_SIZES, seatsLeft, type LiveRoom } from '@/lib/equb-math';
import clsx from 'clsx';

type StatusFilter = 'all' | LiveRoom['status'];

function statusBadge(status: LiveRoom['status']) {
  if (status === 'open') {
    return { label: 'Open', className: 'bg-equb-500/20 text-equb-400' };
  }
  if (status === 'drawing') {
    return { label: 'Drawing', className: 'bg-gold-500/20 text-gold-400' };
  }
  return { label: 'Finished', className: 'bg-white/10 text-white/40' };
}

function roomHint(r: LiveRoom) {
  if (r.status === 'open') {
    const left = seatsLeft(r);
    if (left === 0) return 'Full · ready to draw';
    if (r.members.length === 0) return 'Empty · be first to join';
    return `${left} seat${left === 1 ? '' : 's'} left`;
  }
  if (r.status === 'drawing') return 'Draw in progress…';
  if (r.winningNumber != null) return `Winner #${r.winningNumber}`;
  return 'Round finished';
}

export default function RoomsPage() {
  const rooms = useEqubStore((s) => s.rooms);
  const ensureRooms = useEqubStore((s) => s.ensureRooms);
  const user = useEqubStore((s) => s.user);
  const [sizeFilter, setSizeFilter] = useState<number | 'all'>('all');
  const [tier, setTier] = useState<'all' | 'entry' | 'low' | 'mid' | 'high'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    ensureRooms();
  }, [ensureRooms]);

  const filtered = useMemo(() => {
    return rooms.filter((r) => {
      if (sizeFilter !== 'all' && r.groupSize !== sizeFilter) return false;
      if (tier !== 'all' && r.tier !== tier) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [rooms, sizeFilter, tier, statusFilter]);

  const counts = useMemo(
    () => ({
      open: rooms.filter((r) => r.status === 'open').length,
      drawing: rooms.filter((r) => r.status === 'drawing').length,
      completed: rooms.filter((r) => r.status === 'completed').length,
    }),
    [rooms],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Rooms</h1>
        <p className="text-sm text-white/50">Pick a number · computer draws · one winner</p>
      </div>

      {!user && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Sign in from Profile to join rooms with virtual Birr.
        </p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            { key: 'all' as const, label: 'All' },
            { key: 'open' as const, label: `Open (${counts.open})` },
            { key: 'drawing' as const, label: `Drawing (${counts.drawing})` },
            { key: 'completed' as const, label: `Finished (${counts.completed})` },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={clsx(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
              statusFilter === key ? 'bg-white text-black' : 'bg-white/5 text-white/60',
            )}
          >
            {label}
          </button>
        ))}
      </div>

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

      {filtered.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm text-white/50">No rooms match these filters.</p>
          <button
            onClick={() => {
              setStatusFilter('all');
              setSizeFilter('all');
              setTier('all');
            }}
            className="mt-3 text-xs text-equb-400 underline"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="space-y-3">
        {filtered.slice(0, 40).map((r) => {
          const badge = statusBadge(r.status);
          const left = seatsLeft(r);
          const progress =
            r.status === 'completed'
              ? 100
              : Math.min(100, (r.members.length / r.groupSize) * 100);

          return (
            <Link
              key={r.id}
              href={`/rooms/${r.id}`}
              className={clsx(
                'glass block rounded-2xl p-4 transition hover:border-equb-500/40',
                r.status === 'completed' && 'opacity-75',
                r.status === 'drawing' && 'ring-1 ring-gold-500/30',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {r.groupSize} players · {r.prizePool.toLocaleString()} Birr
                  </p>
                  <p className="mt-0.5 text-xs text-white/50">
                    Pay <span className="text-equb-400">{r.contribution}</span> each · {r.tier}{' '}
                    tier
                  </p>
                </div>
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              </div>

              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      r.status === 'completed' ? 'bg-gold-500' : 'bg-equb-500',
                      r.status === 'drawing' && 'animate-pulse bg-gold-400',
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-white/40">
                  {r.members.length}/{r.groupSize} seats
                  {r.status === 'open' && left > 0 ? ` · ${left} left` : ''}
                  {' · '}
                  {roomHint(r)}
                </p>
              </div>

              {r.status === 'open' && left > 0 && (
                <p className="mt-2 text-[11px] font-medium text-equb-400">Join & pick a number →</p>
              )}
              {r.status === 'open' && left === 0 && (
                <p className="mt-2 text-[11px] font-medium text-gold-400">Open room · draw when ready →</p>
              )}
              {r.status === 'drawing' && (
                <p className="mt-2 text-[11px] font-medium text-gold-400">Watch the draw →</p>
              )}
              {r.status === 'completed' && r.winningNumber != null && (
                <p className="mt-2 text-[11px] text-white/50">
                  Result: number <span className="font-mono text-gold-400">#{r.winningNumber}</span>
                </p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
