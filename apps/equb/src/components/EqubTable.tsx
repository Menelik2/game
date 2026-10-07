'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import { useLocale } from '@/lib/i18n/LanguageContext';
import { maxPicksForGroup, splitPot } from '@/lib/equb-math';
import { EqubCountdown } from '@/components/EqubBoard';

function birr(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  return `${n.toLocaleString()} ብር`;
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

  return (
    <div className="space-y-3">
      {status === 'open' && <EqubCountdown secondsLeft={clock} />}
      <div className="grid gap-3 lg:grid-cols-[1fr_9rem_9rem]">
        <div className="order-1">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/40">
            <span className="font-semibold text-white/55">
              {locale === 'am'
                ? `ቱጥር ይምረጡ · ከፍተኛ ${maxSelect}`
                : `Pick numbers · max ${maxSelect}`}
            </span>
            {payoutHint != null && (
              <span className="text-gold-400/80">~{birr(payoutHint)}</span>
            )}
          </div>
          <div
            className={clsx(
              'grid gap-1.5',
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
                    'relative flex aspect-square items-center justify-center rounded-xl text-[11px] font-black transition-all duration-200 sm:text-sm',
                    isWin && 'bg-gold-400 text-black ring-2 ring-gold-200',
                    isYours && !isWin && 'bg-equb-500 text-white ring-2 ring-equb-200',
                    isTaken && !isYours && 'bg-white/5 text-white/25',
                    locked && !isTaken && 'cursor-not-allowed bg-[#151c1a] text-white/25',
                    canClick && 'bg-[#151c1a] text-white/80 hover:scale-105 hover:bg-white/12',
                    !canClick && !isYours && !isTaken && !isWin && 'bg-[#151c1a] text-white/40',
                  )}
                >
                  {String(n).padStart(2, '0')}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {canBet && (
              <button
                type="button"
                disabled={joining || selected.length === 0}
                onClick={onBet}
                className="btn-gold flex-1 disabled:opacity-40"
              >
                {joining ? '...' : `BET · ${selected.length}/${maxSelect}`}
              </button>
            )}
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
                {lastAdminFee != null ? birr(lastAdminFee) : ''}
                {' · '}
                {lastWinnerPayout != null ? birr(lastWinnerPayout) : ''}
              </p>
            )}
        </div>
        <div className="order-2 rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] font-bold uppercase text-white/40">
            {locale === 'am' ? 'ተጫዋች' : 'Players'}
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
            {players.length === 0 && (
              <li className="text-white/30">{locale === 'am' ? 'ገና የለም' : 'None yet'}</li>
            )}
            {players.map((pl) => (
              <li
                key={pl.id}
                className={clsx(
                  'flex justify-between gap-1 rounded-lg px-1.5 py-1',
                  pl.isYou && 'bg-equb-500/20',
                  pl.status === 'won' && 'bg-gold-400/15',
                )}
              >
                <span className="truncate">{pl.name}</span>
                <span className="font-mono text-white/50">
                  #{(pl.picks || [pl.pick]).map((x) => String(x).padStart(2, '0')).join(',')}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="order-3 rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] font-bold uppercase text-white/40">
            {locale === 'am' ? 'ውጤቶች' : 'Results'}
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
            {results.length === 0 && (
              <li className="text-white/30">{locale === 'am' ? 'ገና የለም' : 'None yet'}</li>
            )}
            {results.slice(0, 12).map((r, i) => (
              <li key={r.id || i} className="flex justify-between gap-1">
                <span className="truncate">{r.winnerName}</span>
                <span className="shrink-0 font-mono text-gold-400/80">
                  #{String(r.winningNumber).padStart(2, '0')} · {birr(r.pot)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-white/30">{birr(contribution)} / seat</p>
        </div>
      </div>
    </div>
  );
}
