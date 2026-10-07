'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { useLocale } from '@/lib/i18n/LanguageContext';
import { maxPicksForGroup, splitPot } from '@/lib/equb-math';
import { EqubCountdown } from '@/components/EqubBoard';

function birr(amount: number, am: boolean): string {
  const n = Math.round(Number(amount) || 0);
  return am ? `${n.toLocaleString()} ብር` : `${n.toLocaleString()} Birr`;
}

export type TablePlayer = {
  id: string;
  name: string;
  pick: number;
  picks?: number[];
  isYou?: boolean;
  status: 'waiting' | 'won' | 'lost';
};

export type TableResult = {
  id?: string;
  winningNumber: number;
  winnerName: string;
  pot: number;
  at?: number;
};

type Props = {
  groupSize: number;
  prizePool: number;
  contribution: number;
  taken: Set<number>;
  selected: number[];
  yourPicks: number[];
  winningNumber?: number | null;
  status: 'open' | 'drawing' | 'completed';
  players: TablePlayer[];
  results?: TableResult[];
  secondsLeft?: number;
  roomId?: string;
  lastAdminFee?: number | null;
  lastWinnerPayout?: number | null;
  disabled?: boolean;
  joining?: boolean;
  drawing?: boolean;
  canBet?: boolean;
  canFillBots?: boolean;
  canDraw?: boolean;
  locale?: string;
  maxSelect?: number;
  onToggleSelect: (n: number) => void;
  onBet: () => void;
  onFillBots?: () => void;
  onDraw?: () => void;
  onPlayAgain?: () => void;
};

export function EqubTable({
  groupSize,
  prizePool,
  contribution,
  taken,
  selected,
  yourPicks,
  winningNumber,
  status,
  players,
  results = [],
  secondsLeft,
  lastAdminFee,
  lastWinnerPayout,
  disabled,
  joining,
  drawing,
  canBet,
  canDraw,
  maxSelect: maxSelectProp,
  onToggleSelect,
  onBet,
  onDraw,
}: Props) {
  const locale = useLocale();
  const am = locale === 'am';
  const maxSelect = maxSelectProp ?? maxPicksForGroup(groupSize);
  const pot = Number(prizePool) || 0;
  const preview = useMemo(() => (pot > 0 ? splitPot(pot) : null), [pot]);
  const takenSet = useMemo(() => new Set(taken), [taken]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const atMax = selected.length >= maxSelect;
  const payoutHint =
    preview?.winnerPayout != null
      ? preview.winnerPayout
      : pot > 0
        ? Math.round(pot * 0.85)
        : null;
  const clock = Math.max(0, Math.floor(Number(secondsLeft ?? 60)));
  const seatsTaken = players.reduce(
    (n, p) => n + (p.picks?.length || (p.pick ? 1 : 0)),
    0,
  );

  return (
    <div className="space-y-3.5 pb-24 sm:pb-4">
      {/* Prize hero */}
      <div className="glass relative overflow-hidden rounded-2xl p-3.5">
        <div className="pointer-events-none absolute -right-6 top-0 h-24 w-24 rounded-full bg-gold-500/15 blur-2xl" />
        <div className="relative flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold-400/70">
              {am ? 'ሽልማት' : 'Prize pool'}
            </p>
            <p className="mt-0.5 bg-gradient-to-r from-gold-300 to-gold-500 bg-clip-text text-2xl font-black text-transparent">
              {birr(pot, am)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center">
            <p className="text-[9px] uppercase text-white/40">{am ? 'ክፍያ' : 'Entry'}</p>
            <p className="text-sm font-bold text-equb-300">{birr(contribution, am)}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center">
            <p className="text-[9px] uppercase text-white/40">{am ? 'መቀመጫ' : 'Seats'}</p>
            <p className="text-sm font-bold text-white">
              {seatsTaken}
              <span className="text-white/40">/{groupSize}</span>
            </p>
          </div>
        </div>
      </div>

      {status === 'open' && (
        <EqubCountdown secondsLeft={clock} locale={locale} total={60} />
      )}

      <div className="grid gap-3 lg:grid-cols-[1fr_10.5rem_10.5rem]">
        <div className="order-1">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-white/75">
              {am
                ? `ቁጥር ይምረጡ · ከፍተኛ ${maxSelect}`
                : `Pick numbers · max ${maxSelect}`}
            </span>
            {payoutHint != null && (
              <span className="rounded-full border border-gold-500/25 bg-gold-500/15 px-2.5 py-0.5 font-semibold text-gold-300">
                ~{birr(payoutHint, am)}
              </span>
            )}
          </div>

          <div
            className={clsx(
              'grid gap-2',
              groupSize <= 10 && 'grid-cols-5',
              groupSize > 10 && 'grid-cols-5 sm:grid-cols-10',
            )}
          >
            {Array.from({ length: groupSize }, (_, i) => i + 1).map((n) => {
              const isTaken =
                takenSet.has(n) && !selectedSet.has(n) && !yourPicks.includes(n);
              const isYours = yourPicks.includes(n) || selectedSet.has(n);
              const isWin = status === 'completed' && winningNumber === n;
              const locked =
                !isYours && (isTaken || (atMax && !selectedSet.has(n)));
              const canClick =
                !disabled && status === 'open' && !locked && !isTaken;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!canClick}
                  onClick={() => onToggleSelect(n)}
                  className={clsx(
                    'relative flex aspect-square items-center justify-center rounded-xl text-sm font-black transition-all duration-150 active:scale-95',
                    isWin && 'tile-win text-black',
                    isYours && !isWin && 'tile-selected text-white',
                    isTaken && !isYours && 'tile-taken text-white/30 line-through',
                    locked && !isTaken && 'cursor-not-allowed tile-taken text-white/20',
                    canClick && 'tile text-white/90 hover:brightness-125',
                    !canClick && !isYours && !isTaken && !isWin && 'tile text-white/35',
                  )}
                >
                  {String(n).padStart(2, '0')}
                </button>
              );
            })}
          </div>

          <div className="mt-3 hidden flex-wrap gap-2 sm:flex">
            <button
              type="button"
              disabled={!canBet || joining || selected.length === 0}
              onClick={onBet}
              className="btn-gold relative flex-1 overflow-hidden py-3.5 text-base disabled:opacity-40"
            >
              {selected.length > 0 && !joining && (
                <span className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
              )}
              {joining
                ? '...'
                : selected.length === 0
                  ? am
                    ? 'ቁጥር ይምረጡ'
                    : 'Select a number'
                  : `BET · ${selected.length}/${maxSelect} · ${birr(contribution * selected.length, am)}`}
            </button>
            {canDraw && onDraw && (
              <button
                type="button"
                disabled={drawing}
                onClick={onDraw}
                className="rounded-xl border border-amber-400/40 bg-amber-400/15 px-4 py-2.5 text-sm font-bold text-amber-200"
              >
                {drawing ? '...' : 'Draw'}
              </button>
            )}
          </div>

          {status === 'completed' &&
            (lastAdminFee != null || lastWinnerPayout != null) && (
              <p className="mt-2 text-center text-[11px] text-white/40">
                {lastWinnerPayout != null ? birr(lastWinnerPayout, am) : ''}
                {lastAdminFee != null ? ` · fee ${birr(lastAdminFee, am)}` : ''}
              </p>
            )}
        </div>

        <div className="order-2 grid grid-cols-2 gap-2.5 lg:contents">
          <div className="glass rounded-2xl p-3 lg:order-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
              {am ? 'ተጫዋቾች' : 'Players'}
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
              {players.length === 0 && (
                <li className="text-white/30">{am ? 'ገና የለም' : 'None yet'}</li>
              )}
              {players.map((pl) => (
                <li
                  key={pl.id}
                  className={clsx(
                    'flex justify-between gap-1 rounded-lg px-2 py-1.5',
                    pl.isYou && 'bg-equb-500/25 ring-1 ring-equb-400/30',
                    pl.status === 'won' && 'bg-gold-400/20 ring-1 ring-gold-400/30',
                  )}
                >
                  <span className="truncate font-medium">{pl.name}</span>
                  <span className="shrink-0 font-mono text-white/55">
                    #{(pl.picks || [pl.pick]).map((x) => String(x).padStart(2, '0')).join(',')}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass rounded-2xl p-3 lg:order-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
              {am ? 'ውጤቶች' : 'Results'}
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
              {results.length === 0 && (
                <li className="text-white/30">{am ? 'ገና የለም' : 'None yet'}</li>
              )}
              {results.slice(0, 10).map((r, i) => (
                <li key={r.id || i} className="flex justify-between gap-1 rounded-lg px-1 py-0.5">
                  <span className="truncate text-white/80">{r.winnerName}</span>
                  <span className="shrink-0 font-mono font-semibold text-gold-400">
                    #{String(r.winningNumber).padStart(2, '0')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Sticky mobile BET */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-white/10 bg-[#060c0a]/92 px-3 py-2.5 backdrop-blur-xl sm:hidden safe-bottom">
        <button
          type="button"
          disabled={!canBet || joining || selected.length === 0}
          onClick={onBet}
          className="btn-gold relative w-full overflow-hidden py-3.5 text-base font-black disabled:opacity-40"
        >
          {selected.length > 0 && !joining && (
            <span className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          )}
          {joining
            ? '...'
            : selected.length === 0
              ? am
                ? 'ቁጥር ይምረጡ · ከዚያ BET'
                : 'Select number · then BET'
              : `BET · ${birr(contribution * selected.length, am)}`}
        </button>
      </div>
    </div>
  );
}
