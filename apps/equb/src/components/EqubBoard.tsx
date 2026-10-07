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
      {Array.from({ length: groupSize }, (_, i) => i + 1).map((n) => {
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
            className={clsx(
              'aspect-square rounded-lg text-xs font-bold transition sm:text-sm',
              isWinner &&
                'bg-gold-500 text-black ring-2 ring-gold-300 shadow-lg shadow-gold-500/30',
              !isWinner && isYours && 'bg-equb-500 text-white ring-2 ring-equb-300',
              !isWinner &&
                !isYours &&
                isSelected &&
                'bg-equb-500/80 text-white ring-2 ring-equb-400',
              !isWinner &&
                !isYours &&
                !isSelected &&
                isTaken &&
                'bg-white/10 text-white/30 line-through',
              !isWinner &&
                !isYours &&
                !isSelected &&
                !isTaken &&
                'bg-surface-800 text-white/70 hover:bg-white/15',
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
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gold-400/80">How to play</p>
      <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-white/55">
        <li>
          · Choose <span className="text-white">1 number</span> from 01–
          {String(groupSize).padStart(2, '0')}
        </li>
        <li>
          · Pay <span className="text-equb-400">{contribution}</span> Birr entry
        </li>
        <li>
          · When seats fill or timer hits 0, computer draws once
        </li>
        <li>
          · Matching number wins:{' '}
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
        wasYou ? 'border-gold-500/40 bg-gold-500/15' : 'border-white/10 bg-black/50',
      )}
    >
      <p className="text-[10px] uppercase tracking-widest text-white/40">Winning number</p>
      <p className="mt-1 text-5xl font-black tabular-nums text-gold-400">
        {String(winningNumber).padStart(2, '0')}
      </p>
      <p className="mt-2 text-sm">
        {wasYou ? (
          <span className="font-bold text-gold-400">You won {prizePool.toLocaleString()} Birr!</span>
        ) : (
          <>
            Winner: <span className="font-semibold text-white">{winnerName}</span>
          </>
        )}
      </p>
    </div>
  );
}

/** Classic 60s MM:SS countdown */
export function EqubCountdown({
  secondsLeft,
  locale = 'am',
}: {
  secondsLeft: number;
  locale?: string;
}) {
  const safe = Math.max(0, Math.floor(secondsLeft));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  const urgent = safe <= 10;
  const am = locale === 'am';
  return (
    <div
      className={clsx(
        'rounded-2xl border px-4 py-3.5 text-center shadow-lg',
        urgent
          ? 'border-gold-500/50 bg-gradient-to-b from-gold-500/20 to-gold-500/5'
          : 'border-white/10 bg-gradient-to-b from-white/[0.07] to-black/40',
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
        {am ? 'ቀጣይ ዕጣ' : 'Next random draw'}
      </p>
      <p
        className={clsx(
          'mt-1 font-mono text-4xl font-black tabular-nums tracking-tight sm:text-5xl',
          urgent ? 'animate-pulse text-gold-400' : 'text-white',
        )}
      >
        {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </p>
      <p className="mt-1.5 text-[11px] text-white/45">
        {am
          ? 'በየ 60 ሰከንድ አንድ አሸናፊ ቁጥር ይመረጣል'
          : 'Every 60s one winning number is chosen'}
      </p>
    </div>
  );
}

export function EqubSeatLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[10px] text-white/45">
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-surface-800" /> Free
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-equb-500" /> Yours
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-white/20" /> Taken
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-gold-500" /> Winner
      </span>
    </div>
  );
}
