'use client';

import clsx from 'clsx';

type Props = {
  groupSize: number;
  picks: number[];
  maxPicks: number;
  locale?: string;
  onToggle: (n: number) => void;
  onClear?: () => void;
};

function gridCols(groupSize: number): number {
  if (groupSize <= 10) return 5;
  if (groupSize <= 20) return 5;
  if (groupSize <= 40) return 8;
  if (groupSize <= 60) return 10;
  return 10;
}

export function NumberPickBoard({
  groupSize,
  picks,
  maxPicks,
  locale = 'am',
  onToggle,
  onClear,
}: Props) {
  const am = locale === 'am';
  const cols = gridCols(groupSize);
  const full = picks.length >= maxPicks;
  const huge = groupSize >= 50;
  const large = groupSize >= 30 && groupSize < 50;
  const progress = Math.min(100, (picks.length / Math.max(maxPicks, 1)) * 100);

  return (
    <div
      role="group"
      aria-label={am ? `ቁጥር ምረጥ 1 እስከ ${groupSize}` : `Pick numbers 1 to ${groupSize}`}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0e1815]/95 to-[#080e0c] p-3 sm:p-5"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-equb-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-gold-500/10 blur-2xl" />

      <div className="relative mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
            {am ? 'ቁጥር ምረጥ' : 'PICK NUMBERS'}
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            {am
              ? `ከ 1 – ${groupSize} · ቢያንስ 1 · ከፍተኛ ${maxPicks}`
              : `1 – ${groupSize} · min 1 · max ${maxPicks}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={clsx(
              'rounded-full px-2.5 py-1 text-[11px] font-black tabular-nums',
              full
                ? 'bg-gold-500/25 text-gold-300 ring-1 ring-gold-400/40'
                : 'bg-equb-500/20 text-equb-300',
            )}
          >
            {picks.length}/{maxPicks}
          </span>
          {picks.length > 0 && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] font-semibold text-white/35 underline-offset-2 hover:text-red-300 hover:underline focus-visible:ring-2 focus-visible:ring-red-400"
            >
              {am ? 'አጽዳ' : 'Clear'}
            </button>
          )}
        </div>
      </div>

      <div
        className="relative mb-3 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={picks.length}
        aria-valuemin={0}
        aria-valuemax={maxPicks}
        aria-label={am ? 'የምርጫ ሂደት' : 'Pick progress'}
      >
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-300 ease-out',
            full ? 'bg-gold-400' : 'bg-equb-400',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="relative mb-3 flex min-h-[2.25rem] flex-wrap gap-1.5">
        {picks.length === 0 ? (
          <p className="w-full py-1 text-center text-[11px] text-white/30">
            {am ? 'ቁጥር ለመምረጥ ከታች ይንኩ' : 'Tap a number below to select'}
          </p>
        ) : (
          picks.map((n) => (
            <button
              key={`sel-${n}`}
              type="button"
              onClick={() => onToggle(n)}
              className="inline-flex h-8 min-w-[2rem] items-center justify-center gap-1 rounded-lg bg-equb-500/30 px-2 font-mono text-xs font-black text-equb-100 ring-1 ring-equb-400/50 transition active:scale-95 animate-pick-bounce"
              aria-label={am ? `ቁጥር ${n} አስወግድ` : `Remove number ${n}`}
            >
              {String(n).padStart(2, '0')}
              <span className="text-[10px] font-bold text-equb-200/70">×</span>
            </button>
          ))
        )}
      </div>

      <div
        className={clsx(
          'relative grid',
          huge ? 'gap-1' : large ? 'gap-1.5' : 'gap-1.5 sm:gap-2',
        )}
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: groupSize }, (_, i) => i + 1).map((n, idx) => {
          const on = picks.includes(n);
          const locked = !on && full;
          const order = on ? picks.indexOf(n) + 1 : 0;

          return (
            <button
              key={n}
              type="button"
              disabled={locked}
              aria-pressed={on}
              aria-label={
                am
                  ? on
                    ? `ቁጥር ${n} ተመርጧል`
                    : `ቁጥር ${n} ምረጥ`
                  : on
                    ? `Number ${n} selected`
                    : `Select number ${n}`
              }
              onClick={() => onToggle(n)}
              style={{ animationDelay: `${Math.min(idx, 40) * 8}ms` }}
              className={clsx(
                'relative flex w-full items-center justify-center rounded-lg font-mono font-black transition active:scale-95 focus-visible:ring-2 focus-visible:ring-equb-400',
                huge
                  ? 'h-8 text-[10px] sm:h-9 sm:text-xs'
                  : large
                    ? 'h-9 text-xs sm:h-10 sm:text-sm'
                    : 'h-11 text-sm sm:h-12 sm:text-base',
                on && 'tile-selected z-10 text-white',
                !on && !locked && 'tile text-white/85',
                locked && 'cursor-not-allowed opacity-35 tile-taken text-white/20',
              )}
            >
              {String(n).padStart(2, '0')}
              {on && maxPicks > 1 && (
                <span
                  className={clsx(
                    'absolute flex items-center justify-center rounded-full bg-equb-300 font-black text-black',
                    huge
                      ? 'right-0.5 top-0.5 h-2.5 w-2.5 text-[7px]'
                      : 'right-1 top-1 h-3.5 w-3.5 text-[8px]',
                  )}
                  aria-hidden
                >
                  {order}
                </span>
              )}
              {on && (
                <span
                  className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-equb-300/40"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="relative mt-3 text-center text-[10px] text-white/35">
        {full
          ? am
            ? 'ሙሉ — ካስፈለገ ቁጥር ይንኩ ለመቀየር'
            : 'Full — tap a selected number to change'
          : am
            ? 'ተጨማሪ ቁጥር ለመምረጥ ይንኩ'
            : 'Tap to add more numbers'}
      </p>
    </div>
  );
}
