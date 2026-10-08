'use client';

import clsx from 'clsx';

type Props = {
  groupSize: number;
  taken: Set<number>;
  selected: number | null;
  winningNumber: number | null;
  yourPick?: number | null;
  disabled?: boolean;
  onSelect: (n: number) => void;
};

export function EqubBoard({
  groupSize,
  taken,
  selected,
  winningNumber,
  yourPick,
  disabled,
  onSelect,
}: Props) {
  const cols =
    groupSize <= 10 ? 5 : groupSize <= 20 ? 5 : groupSize <= 40 ? 5 : groupSize <= 50 ? 5 : 10;

  return (
    <div
      className="grid gap-1.5 sm:gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.min(cols, 10)}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: groupSize }, (_, i) => i + 1).map((n, idx) => {
        const isTaken = taken.has(n);
        const isSelected = selected === n;
        const isWinner = winningNumber === n;
        const isYours = yourPick === n;

        return (
          <button
            key={n}
            type="button"
            disabled={disabled || isTaken}
            onClick={() => onSelect(n)}
            style={{ animationDelay: `${idx * 18}ms` }}
            className={clsx(
              'aspect-square rounded-xl text-xs font-black sm:text-sm',
              isWinner && 'tile-win text-black',
              !isWinner && isYours && 'tile-selected text-white',
              !isWinner && !isYours && isSelected && 'tile-selected text-white',
              !isWinner &&
                !isYours &&
                !isSelected &&
                isTaken &&
                'tile-taken text-white/30 line-through',
              !isWinner &&
                !isYours &&
                !isSelected &&
                !isTaken &&
                'tile text-white/80 hover:brightness-125',
            )}
          >
            {String(n).padStart(2, '0')}
          </button>
        );
      })}
    </div>
  );
}

export function EqubRulesCard({
  groupSize,
  contribution,
  prizePool,
}: {
  groupSize: number;
  contribution: number;
  prizePool: number;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gold-400/80">How to play</p>
      <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-white/55">
        <li>· Choose numbers from 01–{String(groupSize).padStart(2, '0')}</li>
        <li>
          · Pay <span className="text-equb-300">{contribution}</span> Birr entry
        </li>
        <li>· Timer hits 0 → one winning number drawn</li>
        <li>
          · Win up to{' '}
          <span className="font-semibold text-gold-400">{prizePool.toLocaleString()}</span> Birr
        </li>
      </ul>
    </div>
  );
}

export function EqubResultBanner({
  winningNumber,
  winnerName,
  prizePool,
  wasYou,
}: {
  winningNumber: number;
  winnerName: string;
  prizePool: number;
  wasYou?: boolean;
}) {
  return (
    <div
      className={clsx(
        'rounded-2xl border p-5 text-center',
        wasYou
          ? 'border-gold-500/40 bg-gradient-to-b from-gold-500/25 to-gold-500/5'
          : 'glass',
      )}
    >
      <p className="text-[10px] uppercase tracking-widest text-white/40">Winning number</p>
      <p className="mt-1 text-5xl font-black tabular-nums text-gold-400 animate-soft-pulse">
        {String(winningNumber).padStart(2, '0')}
      </p>
      <p className="mt-2 text-sm">
        {wasYou ? (
          <span className="font-bold text-gold-400">
            You won {prizePool.toLocaleString()} Birr!
          </span>
        ) : (
          <>
            Winner: <span className="font-semibold text-white">{winnerName}</span>
          </>
        )}
      </p>
    </div>
  );
}

/** Classic circular timer — old animated style */
export function EqubCountdown({
  secondsLeft,
  locale = 'am',
  total = 60,
}: {
  secondsLeft: number;
  locale?: string;
  total?: number;
}) {
  const safe = Math.max(0, Math.floor(secondsLeft));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  const urgent = safe <= 10;
  const critical = safe <= 5;
  const am = locale === 'am';
  const pct = Math.min(1, Math.max(0, safe / Math.max(1, total)));
  const r = 44;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const display = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

  return (
    <div
      className={clsx(
        'timer-classic relative overflow-hidden rounded-2xl border px-4 py-5 text-center',
        urgent ? 'urgent border-gold-500/50' : 'border-white/10',
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-equb-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-gold-500/12 blur-3xl" />

      <p className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
        {am ? 'ቀጣይ ዕጣ' : 'Next random draw'}
      </p>

      <div className="relative mx-auto mt-3 flex h-[128px] w-[128px] items-center justify-center">
        <svg
          className={clsx('absolute inset-0 -rotate-90', !urgent && 'animate-ring-glow')}
          viewBox="0 0 100 100"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="7"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={urgent ? 'rgb(251, 191, 36)' : 'rgb(52, 211, 153)'}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            style={{
              filter: urgent
                ? 'drop-shadow(0 0 10px rgba(251,191,36,0.7))'
                : 'drop-shadow(0 0 8px rgba(52,211,153,0.5))',
            }}
          />
        </svg>

        <div className="relative flex flex-col items-center">
          <p
            key={display}
            className={clsx(
              'animate-digit-tick font-mono text-4xl font-black tabular-nums tracking-tight',
              critical && 'animate-soft-pulse text-gold-300',
              urgent && !critical && 'text-gold-400',
              !urgent && 'text-white',
            )}
          >
            {display}
          </p>
          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/35">
            {am ? 'ሰከንድ' : 'sec'}
          </p>
        </div>
      </div>

      <p className="relative mt-2 text-[11px] text-white/45">
        {urgent
          ? am
            ? 'ዕጣ በቅርብ…'
            : 'Draw soon…'
          : am
            ? 'በየ 60 ሰከንድ አንድ አሸናፊ ቁጥር ይመረጣል'
            : 'Every 60s one winning number is chosen'}
      </p>

      {/* Progress bar under timer — old style */}
      <div className="relative mx-auto mt-3 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-white/10">
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-1000 ease-linear',
            urgent ? 'bg-gold-400' : 'bg-equb-400',
          )}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

export function EqubSeatLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[10px] text-white/45">
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-md bg-[#1a2420]" /> Free
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-md bg-equb-500" /> Yours
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-md bg-white/15" /> Taken
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-md bg-gold-500" /> Winner
      </span>
    </div>
  );
}
