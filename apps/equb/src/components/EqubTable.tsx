'use client';

import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { formatBirrCompact } from '@/lib/money';
import { interpolate, type Locale } from '@/lib/i18n/dictionaries';

export type TablePlayer = {
  id: string;
  name: string;
  pick: number | null;
  status: 'waiting' | 'ready' | 'won' | 'lost';
  isYou?: boolean;
};

export type TableResult = {
  id: string;
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
  selected: number | null;
  yourPick: number | null;
  winningNumber: number | null;
  status: 'open' | 'drawing' | 'completed';
  players: TablePlayer[];
  results?: TableResult[];
  secondsLeft?: number;
  roomId?: string;
  disabled?: boolean;
  joining?: boolean;
  drawing?: boolean;
  canBet: boolean;
  canFillBots?: boolean;
  canDraw?: boolean;
  locale: Locale;
  onSelect: (n: number) => void;
  onBet: () => void;
  onFillBots?: () => void;
  onDraw?: () => void;
  onPlayAgain?: () => void;
};

function gridCols(groupSize: number): number {
  if (groupSize <= 20) return 5;
  if (groupSize <= 30) return 6;
  if (groupSize <= 50) return 5;
  return 10;
}

export function EqubTable({
  groupSize,
  prizePool,
  contribution,
  taken,
  selected,
  yourPick,
  winningNumber,
  status,
  players,
  results = [],
  secondsLeft = 60,
  roomId,
  disabled,
  joining,
  drawing,
  canBet,
  canFillBots,
  canDraw,
  locale,
  onSelect,
  onBet,
  onFillBots,
  onDraw,
  onPlayAgain,
}: Props) {
  const { t } = useI18n();
  const cols = gridCols(groupSize);
  const safe = Math.max(0, Math.floor(secondsLeft));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  const urgent = safe <= 10 && status === 'open';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-2 sm:space-y-3">
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0a1210] via-[#0c1613] to-[#0a1210] px-2.5 py-2.5 sm:px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded bg-equb-600/30 px-2 py-0.5 text-[10px] font-bold uppercase text-equb-300">
              {t.play.title}
            </span>
            {roomId && (
              <p className="mt-0.5 truncate font-mono text-[9px] text-white/35 sm:text-[10px]">
                ID: {roomId.slice(0, 14)}
              </p>
            )}
          </div>
          <div
            className={clsx(
              'shrink-0 font-mono text-xl font-black tracking-widest sm:text-2xl',
              urgent ? 'animate-pulse text-gold-400' : 'text-white',
            )}
          >
            {status === 'drawing' ? '…' : status === 'completed' ? '00:00' : `${mm}:${ss}`}
          </div>
          <div className="min-w-0 flex-1 text-right text-[9px] text-white/40 sm:text-[10px]">
            <p className="truncate">
              {t.common.pot}{' '}
              <span className="font-bold text-gold-400">
                {formatBirrCompact(prizePool, locale)}
              </span>
            </p>
            <p>
              {players.length}/{groupSize}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:gap-3 lg:grid lg:grid-cols-[minmax(180px,1fr)_minmax(0,2.4fr)_minmax(180px,1fr)] lg:gap-4">
        <section className="order-1 lg:order-2">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0e1815] to-[#0a1210] p-2.5 shadow-soft sm:p-4">
            <div className="mb-2 text-center sm:mb-3">
              <p className="text-xs font-semibold text-white/90 sm:text-sm">
                {interpolate(t.board.chooseOneShort, { size: groupSize })}
              </p>
              <p className="text-[10px] text-white/40 sm:text-[11px]">{t.board.oneWinner}</p>
            </div>

            {status === 'completed' && winningNumber != null && (
              <div className="mb-3 rounded-xl border border-gold-500/30 bg-gold-500/10 py-3 text-center sm:mb-4 sm:py-4">
                <p className="text-[10px] uppercase tracking-widest text-white/40">
                  {t.board.winningNumber}
                </p>
                <p className="font-mono text-4xl font-black text-gold-400 sm:text-5xl">
                  {String(winningNumber).padStart(2, '0')}
                </p>
              </div>
            )}

            <div
              className="mx-auto grid w-full gap-1 sm:gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                maxWidth: groupSize <= 20 ? '26rem' : '100%',
              }}
            >
              {Array.from({ length: groupSize }, (_, i) => i + 1).map((n) => {
                const isTaken = taken.has(n) && yourPick !== n;
                const isSelected = selected === n;
                const isYours = yourPick === n;
                const isWinner = winningNumber === n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={disabled || isTaken || status !== 'open'}
                    onClick={() => onSelect(n)}
                    className={clsx(
                      'flex aspect-square min-h-[2rem] items-center justify-center rounded-md text-[10px] font-bold transition active:scale-95 touch-manipulation sm:min-h-0 sm:text-xs',
                      isWinner &&
                        'bg-gold-500 text-black ring-2 ring-gold-300 shadow-lg shadow-gold-500/40',
                      !isWinner && isYours && 'bg-equb-500 text-white ring-2 ring-equb-300',
                      !isWinner &&
                        !isYours &&
                        isSelected &&
                        'bg-equb-500/90 text-white ring-2 ring-white/30',
                      !isWinner &&
                        !isYours &&
                        !isSelected &&
                        isTaken &&
                        'cursor-not-allowed bg-[#1a2220] text-white/25 line-through',
                      !isWinner &&
                        !isYours &&
                        !isSelected &&
                        !isTaken &&
                        'bg-[#151c1a] text-white/80 hover:bg-white/15',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 space-y-2 sm:mt-4">
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/50 px-3 py-2">
                <span className="text-xs text-white/50">{t.common.entry}</span>
                <span className="font-mono text-sm font-black text-equb-300 sm:text-base">
                  {formatBirrCompact(contribution, locale)}
                </span>
              </div>
              {status === 'open' && (
                <button
                  type="button"
                  disabled={joining}
                  onClick={onBet}
                  className={clsx(
                    'w-full touch-manipulation rounded-xl py-3.5 text-sm font-black uppercase tracking-wide shadow-lg transition active:scale-[0.98] sm:py-4 sm:text-base',
                    canBet
                      ? 'bg-equb-500 text-white shadow-equb-500/40'
                      : 'bg-equb-600/80 text-white/90',
                  )}
                >
                  {joining ? t.common.joining : t.board.bet}
                </button>
              )}
              {status === 'open' && !canBet && (
                <p className="text-center text-[11px] text-amber-400/90">
                  {t.board.selectThenBet}
                </p>
              )}
            </div>

            {canFillBots && onFillBots && (
              <button
                type="button"
                onClick={onFillBots}
                className="mt-2 w-full touch-manipulation rounded-lg border border-white/15 py-2.5 text-xs font-semibold text-white/60"
              >
                {t.common.fillBots}
              </button>
            )}
            {canDraw && onDraw && (
              <button
                type="button"
                disabled={drawing}
                onClick={onDraw}
                className="mt-2 w-full touch-manipulation rounded-lg bg-gold-500 py-3 text-sm font-black text-black disabled:opacity-40"
              >
                {drawing ? t.common.drawing : t.common.runDraw}
              </button>
            )}
            {status === 'completed' && onPlayAgain && (
              <button
                type="button"
                onClick={onPlayAgain}
                className="mt-2 w-full touch-manipulation rounded-lg bg-equb-500 py-3 text-sm font-black"
              >
                {t.common.playAgain}
              </button>
            )}
          </div>
        </section>

        <aside className="order-2 lg:order-1">
          <div className="rounded-xl border border-white/10 bg-[#0a1210] p-2">
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
              {t.common.seats} ({players.length}/{groupSize})
            </p>
            <ul className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {players.length === 0 && (
                <li className="px-2 py-2 text-xs text-white/30">—</li>
              )}
              {players.map((p) => (
                <li
                  key={p.id}
                  className={clsx(
                    'flex shrink-0 flex-col rounded-lg px-2.5 py-1.5 text-[10px]',
                    p.isYou ? 'bg-equb-500/25 ring-1 ring-equb-500/50' : 'bg-white/5',
                  )}
                >
                  <span className="max-w-[4.5rem] truncate font-semibold">
                    {p.isYou ? `${p.name} ★` : p.name}
                  </span>
                  <span className="font-mono text-white/50">
                    {p.pick != null ? `#${String(p.pick).padStart(2, '0')}` : '—'}
                  </span>
                  <span
                    className={clsx(
                      'font-bold uppercase',
                      p.status === 'waiting' && 'text-gold-400',
                      p.status === 'won' && 'text-gold-400',
                      p.status === 'lost' && 'text-white/30',
                    )}
                  >
                    {p.status === 'waiting' && t.board.waitShort}
                    {p.status === 'won' && t.board.won}
                    {p.status === 'lost' && '—'}
                  </span>
                </li>
              ))}
            </ul>
            <ul className="hidden max-h-[28rem] space-y-1.5 overflow-y-auto lg:block">
              {players.length === 0 && (
                <li className="px-2 py-3 text-center text-xs text-white/30">—</li>
              )}
              {players.map((p) => (
                <li
                  key={p.id}
                  className={clsx(
                    'flex items-center justify-between rounded-lg px-2 py-1.5 text-xs',
                    p.isYou ? 'bg-equb-500/20 ring-1 ring-equb-500/40' : 'bg-white/5',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white/90">
                      {p.isYou ? `${p.name} ★` : p.name}
                    </p>
                    <p className="font-mono text-[10px] text-white/40">
                      {p.pick != null ? `#${String(p.pick).padStart(2, '0')}` : '—'}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      'shrink-0 text-[10px] font-bold uppercase',
                      p.status === 'waiting' && 'text-gold-400',
                      p.status === 'won' && 'text-gold-400',
                      p.status === 'lost' && 'text-white/30',
                    )}
                  >
                    {p.status === 'waiting' && t.board.waiting}
                    {p.status === 'won' && t.board.won}
                    {p.status === 'lost' && '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <aside className="order-3">
          <div className="rounded-xl border border-white/10 bg-[#0a1210] p-2">
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-equb-400">
              {t.board.results}
            </p>
            <ul className="flex max-h-28 gap-1.5 overflow-x-auto pb-1 font-mono text-[10px] lg:max-h-72 lg:flex-col lg:space-y-1 lg:overflow-y-auto lg:overflow-x-hidden">
              {results.length === 0 && (
                <li className="px-2 py-2 text-white/30">{t.board.noResults}</li>
              )}
              {results.slice(0, 12).map((r) => (
                <li
                  key={r.id}
                  className="flex shrink-0 items-center gap-2 rounded bg-white/5 px-2 py-1.5 lg:w-full lg:justify-between"
                >
                  <span className="text-gold-400">
                    #{String(r.winningNumber).padStart(2, '0')}
                  </span>
                  <span className="max-w-[4rem] truncate text-white/50 lg:max-w-[6rem]">
                    {r.winnerName}
                  </span>
                  <span className="text-equb-400">{formatBirrCompact(r.pot, locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
