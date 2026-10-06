'use client';

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
  /** @deprecated use yourPicks */
  yourPick?: number | null;
  /** All numbers belonging to the current player */
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
      : 'h-7 w-7 sm:h-8 sm:w-8 text-[9px] sm:text-[10px]';

  return (
    <div className={clsx('flex flex-wrap items-center gap-1', className)}>
      {seats.map((s) => (
        <span
          key={s.index}
          title={s.label}
          className={clsx(
            'inline-flex shrink-0 items-center justify-center rounded-full border transition',
            node,
            s.isYou &&
              'border-equb-300 bg-equb-500 text-white shadow-sm shadow-equb-500/40',
            !s.isYou &&
              s.filled &&
              'border-amber-500/40 bg-amber-500/80 text-black',
            !s.isYou &&
              !s.filled &&
              'border-white/15 bg-white/5 text-white/25',
          )}
        >
          {size === 'md' ? (s.filled ? s.label : '·') : null}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-[10px] font-medium text-white/35">+{overflow}</span>
      )}
    </div>
  );
}

export function SeatRing({
  total,
  filledCount,
  yourPick,
  yourPicks,
  taken,
  className,
}: {
  total: number;
  filledCount: number;
  yourPick?: number | null;
  yourPicks?: number[];
  taken?: Iterable<number>;
  className?: string;
}) {
  const n = Math.min(total, 24);
  const takenSet = taken ? new Set(taken) : null;
  const yours = new Set(
    yourPicks && yourPicks.length
      ? yourPicks
      : yourPick != null
        ? [yourPick]
        : [],
  );

  return (
    <div
      className={clsx('relative mx-auto', className)}
      style={{ width: 88, height: 88 }}
    >
      <div className="absolute inset-[22%] rounded-full border border-white/10 bg-black/40" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold tabular-nums text-white/70">
          {filledCount}/{total}
        </span>
      </div>
      {Array.from({ length: n }, (_, i) => {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r = 36;
        const x = 44 + r * Math.cos(angle);
        const y = 44 + r * Math.sin(angle);
        const seatNum = i + 1;
        const filled = takenSet ? takenSet.has(seatNum) : i < filledCount;
        const isYou = yours.has(seatNum);
        return (
          <span
            key={i}
            className={clsx(
              'absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border',
              isYou && 'border-equb-200 bg-equb-400',
              !isYou && filled && 'border-amber-400/50 bg-amber-500',
              !isYou && !filled && 'border-white/20 bg-white/10',
            )}
            style={{ left: x, top: y }}
          />
        );
      })}
    </div>
  );
}
