'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

type Seat = {
  index: number;
  filled: boolean;
  isYou?: boolean;
  label?: string;
};

type Props = {
  total: number;
  taken: Iterable<number>;
  yourPick?: number | null;
  yourPicks?: number[];
  size?: 'sm' | 'md';
  className?: string;
  maxVisible?: number;
};

export function SeatNodes({
  total,
  taken,
  yourPick = null,
  yourPicks,
  size = 'sm',
  className,
  maxVisible,
}: Props) {
  const takenSet = taken instanceof Set ? taken : new Set(taken);
  const yours = new Set(
    yourPicks && yourPicks.length
      ? yourPicks
      : yourPick != null
        ? [yourPick]
        : [],
  );
  const limit = maxVisible ?? total;
  const show = Math.min(total, limit);
  const overflow = total - show;

  const seats: Seat[] = Array.from({ length: show }, (_, i) => {
    const index = i + 1;
    return {
      index,
      filled: takenSet.has(index),
      isYou: yours.has(index),
      label: String(index).padStart(2, '0'),
    };
  });

  const node =
    size === 'sm'
      ? 'h-2.5 w-2.5 sm:h-3 sm:w-3'
      : 'h-8 w-8 sm:h-9 sm:w-9 text-[10px] sm:text-[11px]';

  return (
    <div className={clsx('flex flex-wrap items-center justify-center gap-1.5', className)}>
      {seats.map((s, i) => (
        <span
          key={s.index}
          title={s.label}
          style={{ animationDelay: `${i * 40}ms` }}
          className={clsx(
            'inline-flex shrink-0 items-center justify-center rounded-full border font-mono font-bold transition-all duration-300',
            node,
            s.isYou &&
              'scale-110 border-equb-200 bg-equb-500 text-white shadow-lg shadow-equb-500/50',
            !s.isYou &&
              s.filled &&
              'scale-105 border-amber-400/60 bg-amber-500 text-black shadow-md shadow-amber-500/30',
            !s.isYou && !s.filled && 'border-white/20 bg-white/5 text-white/30',
          )}
        >
          {size === 'md' ? (s.filled ? s.label : '·') : null}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] font-bold text-white/40">+{overflow}</span>
      )}
    </div>
  );
}

/** Compact circular seat meter for room lists + play page */
export function SeatRing({
  total,
  filledCount,
  yourPick,
  yourPicks,
  taken,
  drawing = false,
  size = 'sm',
  className,
}: {
  total: number;
  filledCount: number;
  yourPick?: number | null;
  yourPicks?: number[];
  taken?: Iterable<number>;
  drawing?: boolean;
  /** sm = list row (48px), md = card (80px), lg = play hero (120px) */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dim = size === 'lg' ? 120 : size === 'md' ? 80 : 48;
  const n = Math.min(Math.max(total, 1), size === 'sm' ? 16 : 40);
  const takenSet = taken ? new Set(taken) : null;
  const yours = new Set(
    yourPicks && yourPicks.length
      ? yourPicks
      : yourPick != null
        ? [yourPick]
        : [],
  );
  const pct = Math.min(1, filledCount / Math.max(total, 1));
  const cx = dim / 2;
  const cy = dim / 2;
  const r = size === 'sm' ? 16 : size === 'md' ? 28 : 46;
  const stroke = size === 'sm' ? 3 : 4;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setTick((t) => t + 1),
      drawing ? 90 : 1200,
    );
    return () => window.clearInterval(id);
  }, [drawing]);

  const fontMain = size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-[15px]';
  const fontSub = size === 'sm' ? 'text-[7px]' : 'text-[8px]';
  const hubInset = size === 'sm' ? 'inset-[22%]' : 'inset-[26%]';

  return (
    <div
      className={clsx('relative shrink-0 select-none', className)}
      style={{ width: dim, height: dim }}
    >
      <div
        className={clsx(
          'pointer-events-none absolute -inset-1 rounded-full opacity-50 blur-lg transition-all duration-700',
          drawing && 'bg-gold-500/30',
          !drawing && pct >= 1 && 'bg-gold-500/25',
          !drawing && pct > 0 && pct < 1 && 'bg-equb-500/20',
        )}
      />

      {drawing && (
        <div className="pointer-events-none absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-gold-400 border-r-gold-400/40" />
      )}

      <svg width={dim} height={dim} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={pct >= 1 || drawing ? 'rgb(251, 191, 36)' : 'rgb(52, 211, 153)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
          style={{
            filter:
              pct > 0
                ? `drop-shadow(0 0 6px ${pct >= 1 ? 'rgba(251,191,36,0.7)' : 'rgba(52,211,153,0.55)'})`
                : undefined,
          }}
        />
      </svg>

      <div
        className={clsx(
          'absolute flex flex-col items-center justify-center rounded-full border bg-gradient-to-b shadow-inner transition-all duration-500',
          hubInset,
          drawing
            ? 'animate-pulse border-gold-400/50 from-gold-500/25 to-[#0a1210]'
            : pct >= 1
              ? 'border-gold-400/40 from-gold-500/20 to-[#0a1210]'
              : 'border-white/15 from-[#15201c] to-[#0a1210]',
        )}
      >
        <span
          key={drawing ? 'd' : `${filledCount}-${total}`}
          className={clsx(
            'font-mono font-black tabular-nums',
            fontMain,
            drawing ? 'text-gold-300' : pct >= 1 ? 'text-gold-400' : 'text-white/90',
          )}
        >
          {drawing ? '···' : `${filledCount}/${total}`}
        </span>
        {size !== 'sm' && (
          <span
            className={clsx(
              'mt-0.5 font-semibold uppercase tracking-wider',
              fontSub,
              drawing ? 'text-gold-400/80' : 'text-white/35',
            )}
          >
            {drawing ? 'Draw' : pct >= 1 ? 'Full' : 'Seats'}
          </span>
        )}
      </div>

      {size !== 'sm' &&
        Array.from({ length: n }, (_, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const x = cx + r * Math.cos(angle);
          const y = cy + r * Math.sin(angle);
          const seatNum = i + 1;
          const filled = takenSet ? takenSet.has(seatNum) : i < filledCount;
          const isYou = yours.has(seatNum);
          const idlePulse = !filled && !drawing && tick % 2 === i % 2;

          return (
            <span
              key={i}
              title={String(seatNum).padStart(2, '0')}
              className={clsx(
                'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all duration-300',
                isYou &&
                  'z-10 h-3.5 w-3.5 scale-125 border-equb-100 bg-equb-400 shadow-[0_0_12px_rgba(52,211,153,0.95)]',
                !isYou &&
                  filled &&
                  'h-3 w-3 scale-110 border-amber-300/80 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.75)]',
                !isYou && !filled && 'h-2.5 w-2.5 border-white/25 bg-white/10',
                idlePulse && 'scale-90 opacity-50',
                drawing && !filled && 'animate-ping',
              )}
              style={{
                left: x,
                top: y,
                animationDelay: drawing ? `${(i * 40) % 400}ms` : undefined,
                animationDuration: drawing ? '1.1s' : undefined,
              }}
            />
          );
        })}
    </div>
  );
}
