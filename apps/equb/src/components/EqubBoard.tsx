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

/** Fast-Keno-style number grid for Equb (1..groupSize). */
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
          · Pay <span className="text-equb-400">{contribution}</span> virtual Birr entry
        </li>
        <li>
          · When all <span className="text-white">{groupSize}</span> seats fill, computer draws once
        </li>
        <li>
          · Matching number wins the full pot:{' '}
          <span className="font-semibold text-gold-400">{prizePool.toLocaleString()}</span> Birr
        </li>
        <li>· Draw uses CSPRNG (provable-style entropy + hash)</li>
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

/** 60s countdown until next multiplayer draw */
export function EqubCountdown({ secondsLeft }: { secondsLeft: number }) {
  const safe = Math.max(0, Math.floor(secondsLeft));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  const urgent = safe <= 10;
  return (
    <div
      className={
        urgent
          ? 'rounded-2xl border border-gold-500/40 bg-gold-500/15 px-4 py-3 text-center'
          : 'rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-center'
      }
    >
      <p className="text-[10px] uppercase tracking-widest text-white/40">Next random draw</p>
      <p
        className={
          'mt-1 font-mono text-3xl font-black tabular-nums ' +
          (urgent ? 'text-gold-400' : 'text-white')
        }
      >
        {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </p>
      <p className="mt-1 text-[11px] text-white/45">
        Multiple players · every 60s one winning number is chosen
      </p>
    </div>
  );
}

export function EqubSeatLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[10px] text-white/45">
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-surface-800" /> Free node
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded bg-equb-500" /> Your pick
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
