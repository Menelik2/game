'use client';

import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { formatBirrCompact } from '@/lib/money';
import type { Locale } from '@/lib/i18n/dictionaries';

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
  const cols = groupSize <= 20 ? 5 : groupSize <= 50 ? 5 : 10;
  const safe = Math.max(0, Math.floor(secondsLeft));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  const urgent = safe <= 10 && status === 'open';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0a1210] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-equb-600/30 px-2 py-0.5 text-[10px] font-bold uppercase text-equb-300">
            {t.play.title}
          </span>
          {roomId && (
            <span className="font-mono text-[10px] text-white/40">
              ID: {roomId.slice(0, 12)}
            </span>
          )}
        </div>
        <div
          className={clsx(
            'font-mono text-2xl font-black tracking-widest',
            urgent ? 'text-gold-400 animate-pulse' : 'text-white',
          )}
        >
          {status === 'drawing' ? '…' : status === 'completed' ? '00:00' : `${mm}:${ss}`}
        </div>
        <div className="text-right text-[10px] text-white/40">
          <p>
            {t.common.pot}:{' '}
            <span className="font-bold text-gold-400">
              {formatBirrCompact(prizePool, locale)}
            </span>
          </p>
          <p>
            {players.length}/{groupSize} {t.common.seats}
          </p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
        <aside className="order-2 space-y-2 lg:order-1">
          <div className="rounded-xl border border-white/10 bg-[#0a1210] p-2">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
              {t.common.seats}
            </p>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
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
                      p.status === 'ready' && 'text-equb-400',
                      p.status === 'won' && 'text-gold-400',
                      p.status === 'lost' && 'text-white/30',
                    )}
                  >
                    {p.status === 'waiting' && (locale === 'am' ? 'በመጠባበቅ' : 'Waiting')}
                    {p.status === 'ready' && (locale === 'am' ? 'ዝግጁ' : 'Ready')}
                    {p.status === 'won' && (locale === 'am' ? 'አሸናፊ' : 'Won')}
                    {p.status === 'lost' && '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="order-1 space-y-3 lg:order-2">
          <div className="rounded-2xl border border-white/10 bg-[#0c1412] p-3 sm:p-4">
            <div className="mb-3 text-center">
              <p className="text-sm font-semibold text-white/90">
                {locale === 'am'
                  ? `1 ቁጥር ይምረጡ (1–${groupSize})`
                  : `Choose 1 number · From 1 to ${groupSize}`}
              </p>
              <p className="text-[11px] text-white/40">
                {locale === 'am' ? 'አንድ አሸናፊ · ሙሉ ሽልማት' : 'One winner · full pot'}
              </p>
            </div>

            {status === 'completed' && winningNumber != null && (
              <div className="mb-4 rounded-xl border border-gold-500/30 bg-gold-500/10 py-4 text-center">
                <p className="text-[10px] uppercase tracking-widest text-white/40">
                  {t.board.winningNumber}
                </p>
                <p className="font-mono text-5xl font-black text-gold-400">
                  {String(winningNumber).padStart(2, '0')}
                </p>
              </div>
            )}

            <div
              className="mx-auto grid max-w-md gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${Math.min(cols, 10)}, minmax(0, 1fr))`,
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
                      'aspect-square rounded-md text-[11px] font-bold transition sm:text-xs',
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
                        'bg-[#151c1a] text-white/80 hover:bg-white/15 hover:text-white',
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5">
                <span className="text-[10px] text-white/40">{t.common.entry}</span>
                <span className="px-2 font-mono text-sm font-bold text-equb-300">
                  {formatBirrCompact(contribution, locale)}
                </span>
              </div>
              <button
                type="button"
                disabled={!canBet || joining}
                onClick={onBet}
                className="min-w-[7rem] rounded-lg bg-equb-600 px-6 py-2.5 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-equb-600/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {joining ? t.common.joining : locale === 'am' ? 'ውርርድ' : 'BET'}
              </button>
            </div>

            {canFillBots && onFillBots && (
              <button
                type="button"
                onClick={onFillBots}
                className="mt-2 w-full rounded-lg border border-white/15 py-2 text-xs font-semibold text-white/60 hover:bg-white/5"
              >
                {t.common.fillBots}
              </button>
            )}
            {canDraw && onDraw && (
              <button
                type="button"
                disabled={drawing}
                onClick={onDraw}
                className="mt-2 w-full rounded-lg bg-gold-500 py-2.5 text-sm font-black text-black disabled:opacity-40"
              >
                {drawing ? t.common.drawing : t.common.runDraw}
              </button>
            )}
            {status === 'completed' && onPlayAgain && (
              <button
                type="button"
                onClick={onPlayAgain}
                className="mt-2 w-full rounded-lg bg-equb-500 py-2.5 text-sm font-black"
              >
                {t.common.playAgain}
              </button>
            )}
          </div>
        </section>

        <aside className="order-3 space-y-2">
          <div className="rounded-xl border border-white/10 bg-[#0a1210] p-2">
            <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-equb-400">
              {locale === 'am' ? 'ውጤቶች' : 'Results'}
            </p>
            <ul className="max-h-64 space-y-1 overflow-y-auto font-mono text-[10px]">
              {results.length === 0 && (
                <li className="px-2 py-2 text-white/30">
                  {locale === 'am' ? 'ገና ውጤት የለም' : 'No results yet'}
                </li>
              )}
              {results.slice(0, 12).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-1 rounded bg-white/5 px-2 py-1.5"
                >
                  <span className="text-gold-400">
                    #{String(r.winningNumber).padStart(2, '0')}
                  </span>
                  <span className="truncate text-white/50">{r.winnerName}</span>
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
