'use client';

import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { formatBirrCompact } from '@/lib/money';
import { type Locale } from '@/lib/i18n/dictionaries';
import { SeatNodes, SeatRing } from '@/components/SeatNodes';
import { ADMIN_FEE_RATE, maxPicksForGroup, splitPot } from '@/lib/equb-math';

export type TablePlayer = {
  id: string;
  name: string;
  pick: number | null;
  picks?: number[];
  status: 'waiting' | 'ready' | 'won' | 'lost';
  isYou?: boolean;
};

export type TableResult = {
  id: string;
  winningNumber: number;
  winnerName: string;
  pot: number;
  adminFee?: number;
  at?: number;
};

type Props = {
  groupSize: number;
  prizePool: number;
  contribution: number;
  taken: Set<number>;
  selected: number[];
  yourPicks: number[];
  winningNumber: number | null;
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
  canBet: boolean;
  canFillBots?: boolean;
  canDraw?: boolean;
  locale: Locale;
  onToggleSelect: (n: number) => void;
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
  yourPicks,
  winningNumber,
  status,
  players,
  results = [],
  secondsLeft = 60,
  roomId,
  lastAdminFee,
  lastWinnerPayout,
  disabled,
  joining,
  drawing,
  canBet,
  canFillBots,
  canDraw,
  locale,
  onToggleSelect,
  onBet,
  onFillBots,
  onDraw,
  onPlayAgain,
}: Props) {
  const { t } = useI18n();
  const cols = gridCols(groupSize);
  const maxPicks = maxPicksForGroup(groupSize);
  const safe = Math.max(0, Math.floor(secondsLeft));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  const urgent = safe <= 10 && status === 'open';
  const yourSet = new Set(yourPicks);
  const selectedSet = new Set(selected);
  const feeTotal =
    Math.round(contribution * Math.max(selected.length, 1) * 100) / 100;

  const preview = splitPot(prizePool);
  const feePct = Math.round(ADMIN_FEE_RATE * 100);
  const shownFee =
    status === 'completed' && lastAdminFee != null ? lastAdminFee : preview.adminFee;
  const shownWinner =
    status === 'completed' && lastWinnerPayout != null
      ? lastWinnerPayout
      : preview.winnerPayout;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-2 sm:space-y-3">
      {/* Timer bar */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-[#0a1210] via-[#0c1613] to-[#0a1210] px-2.5 py-2.5 sm:px-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded bg-equb-600/30 px-2 py-0.5 text-[10px] font-bold uppercase text-equb-300">
              {t.play.title}
            </span>
            {roomId && (
              <p className="mt-0.5 truncate font-mono text-[9px] text-white/35">
                ID: {roomId.slice(0, 14)}
              </p>
            )}
          </div>
          <div
            className={clsx(
              'relative shrink-0 font-mono text-xl font-black tracking-widest sm:text-2xl',
              urgent && 'animate-pulse text-gold-400',
              status === 'drawing' && 'text-gold-400',
              !urgent && status !== 'drawing' && 'text-white',
            )}
          >
            {status === 'drawing'
              ? '···'
              : status === 'completed'
                ? '00:00'
                : `${mm}:${ss}`}
            {urgent && (
              <span className="absolute -inset-2 animate-ping rounded-full bg-gold-500/20" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-right text-[9px] text-white/40">
            <p>
              {t.common.pot}{' '}
              <span className="font-bold text-gold-400">
                {formatBirrCompact(prizePool, locale)}
              </span>
            </p>
            <p>
              {players.length} players · max {maxPicks} picks
            </p>
          </div>
        </div>
        {/* Timer progress bar */}
        {status === 'open' && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-1000 ease-linear',
                urgent ? 'bg-gold-400' : 'bg-equb-400',
              )}
              style={{ width: `${Math.min(100, (safe / 60) * 100)}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:gap-3 lg:grid lg:grid-cols-[minmax(180px,1fr)_minmax(0,2.4fr)_minmax(180px,1fr)] lg:gap-4">
        <section className="order-1 lg:order-2">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#0e1815] to-[#0a1210] p-2.5 shadow-soft sm:p-4">
            <div className="mb-2 text-center sm:mb-3">
              <p className="text-xs font-semibold text-white/90 sm:text-sm">
                {locale === 'am'
                  ? `እስከ ${maxPicks} ቁጥር ይምረጡ (${groupSize}÷5)`
                  : `Pick up to ${maxPicks} number(s) (${groupSize}÷5)`}
              </p>
              <p className="text-[10px] text-equb-300 sm:text-[11px]">
                {selected.length}/{maxPicks} selected
                {selected.length > 0 && (
                  <span className="ml-2 font-mono">
                    #{selected.map((p) => String(p).padStart(2, '0')).join(' · #')}
                  </span>
                )}
              </p>
            </div>

            {status === 'completed' && winningNumber != null && (
              <div className="mb-3 space-y-2 animate-[fadeIn_0.5s_ease-out]">
                <div className="relative overflow-hidden rounded-xl border border-gold-500/40 bg-gold-500/10 py-4 text-center">
                  <div className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-gold-400/10 to-transparent" />
                  <p className="text-[10px] uppercase tracking-widest text-white/40">
                    {t.board.winningNumber}
                  </p>
                  <p className="mt-1 font-mono text-5xl font-black text-gold-400 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]">
                    {String(winningNumber).padStart(2, '0')}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-center">
                  <div>
                    <p className="text-[9px] uppercase text-white/40">Pot</p>
                    <p className="font-mono text-xs font-bold">
                      {formatBirrCompact(prizePool, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-equb-300/80">Winner 85%</p>
                    <p className="font-mono text-xs font-bold text-equb-300">
                      {formatBirrCompact(shownWinner, locale)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase text-amber-300/80">Admin {feePct}%</p>
                    <p className="font-mono text-xs font-bold text-amber-300">
                      {formatBirrCompact(shownFee, locale)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Number grid — tactile game tiles */}
            <div
              className="mx-auto grid w-full gap-1.5 sm:gap-2"
              style={{
                gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                maxWidth: groupSize <= 20 ? '26rem' : '100%',
              }}
            >
              {Array.from({ length: groupSize }, (_, i) => i + 1).map((n) => {
                const isYours = yourSet.has(n);
                const isSelected = selectedSet.has(n);
                const isTaken = taken.has(n) && !isYours;
                const isWinner = winningNumber === n;
                const canClick =
                  !disabled &&
                  !isTaken &&
                  status === 'open' &&
                  (isSelected || selected.length < maxPicks || yourPicks.length > 0);
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={!canClick && !isSelected}
                    onClick={() => onToggleSelect(n)}
                    className={clsx(
                      'relative flex aspect-square min-h-[2.25rem] items-center justify-center rounded-xl text-[11px] font-black transition-all duration-200 active:scale-90 sm:text-sm',
                      isWinner &&
                        'z-10 scale-110 bg-gold-500 text-black ring-2 ring-gold-200 shadow-[0_0_24px_rgba(251,191,36,0.65)] animate-[winnerPop_0.6s_ease-out]',
                      !isWinner &&
                        isYours &&
                        'bg-equb-500 text-white ring-2 ring-equb-200 shadow-lg shadow-equb-500/40',
                      !isWinner &&
                        !isYours &&
                        isSelected &&
                        'scale-105 bg-equb-500/95 text-white ring-2 ring-white/50 shadow-md shadow-equb-500/30',
                      !isWinner &&
                        !isYours &&
                        !isSelected &&
                        isTaken &&
                        'cursor-not-allowed bg-[#1a2220] text-white/25 line-through opacity-60',
                      !isWinner &&
                        !isYours &&
                        !isSelected &&
                        !isTaken &&
                        !canClick &&
                        'cursor-not-allowed bg-[#151c1a] text-white/25',
                      !isWinner &&
                        !isYours &&
                        !isSelected &&
                        !isTaken &&
                        canClick &&
                        'bg-[#151c1a] text-white/85 shadow-sm hover:scale-105 hover:bg-white/15 hover:shadow-md hover:shadow-equb-500/10',
                    )}
                  >
                    <span className="relative z-10">{String(n).padStart(2, '0')}</span>
                    {isSelected && !isWinner && (
                      <span className="pointer-events-none absolute inset-0 animate-pulse rounded-xl bg-equb-400/20" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/50 px-3 py-2">
                <span className="text-xs text-white/50">
                  {t.common.entry}
                  {selected.length > 1 ? ` × ${selected.length}` : ''}
                </span>
                <span className="font-mono text-sm font-black text-equb-300">
                  {formatBirrCompact(
                    selected.length > 0 ? feeTotal : contribution,
                    locale,
                  )}
                </span>
              </div>
              {status === 'open' && (
                <button
                  type="button"
                  disabled={joining || !canBet}
                  onClick={onBet}
                  className={clsx(
                    'relative w-full overflow-hidden rounded-xl py-3.5 text-sm font-black uppercase tracking-wide shadow-lg transition active:scale-[0.98]',
                    canBet
                      ? 'bg-equb-500 text-white shadow-equb-500/40 hover:bg-equb-400'
                      : 'bg-equb-600/50 text-white/50',
                  )}
                >
                  {canBet && (
                    <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  )}
                  {joining ? t.common.joining : t.board.bet}
                </button>
              )}
              {status === 'open' && !canBet && (
                <p className="text-center text-[11px] text-amber-400/90">
                  {locale === 'am'
                    ? `ቢያንስ 1 ቁጥር ይምረጡ (ከፍተኛ ${maxPicks})`
                    : `Select 1–${maxPicks} number(s), then BET`}
                </p>
              )}
            </div>

            {canFillBots && onFillBots && (
              <button
                type="button"
                onClick={onFillBots}
                className="mt-2 w-full rounded-lg border border-white/15 py-2.5 text-xs font-semibold text-white/60"
              >
                {t.common.fillBots}
              </button>
            )}
            {canDraw && onDraw && (
              <button
                type="button"
                disabled={drawing}
                onClick={onDraw}
                className="mt-2 w-full rounded-lg bg-gold-500 py-3 text-sm font-black text-black disabled:opacity-40"
              >
                {drawing ? t.common.drawing : t.common.runDraw}
              </button>
            )}
            {status === 'completed' && onPlayAgain && (
              <button
                type="button"
                onClick={onPlayAgain}
                className="mt-2 w-full rounded-lg bg-equb-500 py-3 text-sm font-black"
              >
                {t.common.playAgain}
              </button>
            )}
          </div>
        </section>

        <aside className="order-2 lg:order-1">
          <div className="rounded-xl border border-white/10 bg-[#0a1210] p-2">
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
              {t.common.seats}
            </p>
            <div className="mb-2 flex flex-col items-center gap-3 rounded-lg bg-black/30 p-3">
              <SeatRing
                total={groupSize}
                filledCount={taken.size}
                yourPicks={yourPicks.length ? yourPicks : selected}
                taken={taken}
                drawing={status === 'drawing' || Boolean(drawing)}
              />
              <SeatNodes
                total={groupSize}
                taken={taken}
                yourPicks={yourPicks.length ? yourPicks : selected}
                size="md"
                className="justify-center"
              />
            </div>
            <ul className="hidden max-h-[18rem] space-y-1.5 overflow-y-auto lg:block">
              {players.length === 0 && (
                <li className="px-2 py-3 text-center text-xs text-white/30">—</li>
              )}
              {players.map((p) => {
                const pp =
                  p.picks && p.picks.length
                    ? p.picks
                    : p.pick != null
                      ? [p.pick]
                      : [];
                return (
                  <li
                    key={p.id}
                    className={clsx(
                      'flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition',
                      p.isYou
                        ? 'bg-equb-500/20 ring-1 ring-equb-500/40'
                        : 'bg-white/5',
                      p.status === 'won' && 'bg-gold-500/15 ring-1 ring-gold-400/30',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white/90">
                        {p.isYou ? `${p.name} ★` : p.name}
                      </p>
                      <p className="font-mono text-[10px] text-white/40">
                        {pp.length
                          ? pp.map((x) => `#${String(x).padStart(2, '0')}`).join(' ')
                          : '—'}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-gold-400">
                      {p.status === 'waiting' && t.board.waiting}
                      {p.status === 'won' && t.board.won}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <aside className="order-3">
          <div className="rounded-xl border border-white/10 bg-[#0a1210] p-2">
            <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-equb-400">
              {t.board.results}
            </p>
            <ul className="flex max-h-28 gap-1.5 overflow-x-auto pb-1 font-mono text-[10px] lg:max-h-72 lg:flex-col lg:space-y-1 lg:overflow-y-auto">
              {results.length === 0 && (
                <li className="px-2 py-2 text-white/30">{t.board.noResults}</li>
              )}
              {results.slice(0, 12).map((r) => (
                <li
                  key={r.id}
                  className="flex shrink-0 flex-col gap-0.5 rounded bg-white/5 px-2 py-1.5 lg:w-full"
                >
                  <div className="flex items-center gap-2 lg:justify-between">
                    <span className="text-gold-400">
                      #{String(r.winningNumber).padStart(2, '0')}
                    </span>
                    <span className="max-w-[4rem] truncate text-white/50">
                      {r.winnerName}
                    </span>
                    <span className="text-equb-400">
                      {formatBirrCompact(r.pot, locale)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <style jsx global>{`
        @keyframes winnerPop {
          0% {
            transform: scale(0.6);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.25);
          }
          100% {
            transform: scale(1.1);
            opacity: 1;
          }
        }
        @keyframes shimmer {
          100% {
            transform: translateX(200%);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
