'use client';

import clsx from 'clsx';
import { useMemo } from 'react';
import { useT, useLocale } from '@/lib/i18n';
import { formatBirrCompact } from '@/lib/format';
import { filterRealResults, isRealPlayer } from '@/lib/real-players';

export type TablePlayer = {
  id: string;
  name: string;
  picks: number[];
  isYou?: boolean;
  isBot?: boolean;
  status?: 'waiting' | 'won' | 'lost';
};

export type TableResult = {
  id: string;
  winningNumber: number;
  winnerName: string;
  pot: number;
  at: number;
};

type Props = {
  groupSize: number;
  selected: number[];
  taken: number[];
  maxSelect: number;
  disabled?: boolean;
  status?: string;
  winningNumber?: number | null;
  players?: TablePlayer[];
  results?: TableResult[];
  pot?: number;
  onToggleSelect?: (n: number) => void;
  preview?: { winnerPayout?: number };
};

export function EqubTable({
  groupSize,
  selected,
  taken,
  maxSelect,
  disabled,
  status = 'open',
  winningNumber,
  players = [],
  results = [],
  pot = 0,
  onToggleSelect,
  preview,
}: Props) {
  const t = useT();
  const locale = useLocale();

  // Real humans only in seat list + results
  const realPlayers = useMemo(
    () => players.filter((p) => isRealPlayer(p)),
    [players],
  );
  const realResults = useMemo(
    () => filterRealResults(results),
    [results],
  );

  const numbers = useMemo(
    () => Array.from({ length: groupSize }, (_, i) => i + 1),
    [groupSize],
  );

  const takenSet = useMemo(() => new Set(taken), [taken]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const atMax = selected.length >= maxSelect;

  const payoutHint =
    preview?.winnerPayout != null
      ? preview.winnerPayout
      : pot > 0
        ? Math.round(pot * 0.85)
        : null;

  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_9rem_9rem]">
      <div className="order-1">
        <div className="mb-2 flex items-center justify-between text-[11px] text-white/40">
          <span>
            {t.board?.pick || 'Pick'} · max {maxSelect}
          </span>
          {payoutHint != null && (
            <span className="text-gold-400/80">
              ~{formatBirrCompact(payoutHint, locale)}
            </span>
          )}
        </div>
        <div
          className={clsx(
            'grid gap-1.5',
            groupSize <= 10 && 'grid-cols-5',
            groupSize > 10 && groupSize <= 25 && 'grid-cols-5 sm:grid-cols-5',
            groupSize > 25 && 'grid-cols-5 sm:grid-cols-8',
          )}
        >
          {numbers.map((n) => {
            const isTaken = takenSet.has(n) && !selectedSet.has(n);
            const isSelected = selectedSet.has(n);
            const isWin = status === 'completed' && winningNumber === n;
            return (
              <button
                key={n}
                type="button"
                disabled={
                  disabled ||
                  isTaken ||
                  status !== 'open' ||
                  (atMax && !isSelected)
                }
                onClick={() => onToggleSelect?.(n)}
                className={clsx(
                  'relative aspect-square rounded-xl text-sm font-bold transition',
                  isWin &&
                    'z-10 scale-110 bg-gold-500 text-black ring-2 ring-gold-200 shadow-[0_0_24px_rgba(251,191,36,0.65)] animate-[winnerPop_0.6s_ease-out]',
                  !isWin &&
                    isSelected &&
                    'bg-equb-500 text-black ring-2 ring-equb-300',
                  !isWin &&
                    isTaken &&
                    'cursor-not-allowed bg-white/5 text-white/25 line-through',
                  !isWin &&
                    !isSelected &&
                    !isTaken &&
                    'bg-white/10 text-white/80 hover:bg-white/20',
                  disabled && 'opacity-50',
                )}
              >
                {String(n).padStart(2, '0')}
              </button>
            );
          })}
        </div>
      </div>

      <aside className="order-2">
        <div className="rounded-xl border border-white/10 bg-[#0a1210] p-2">
          <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-equb-400">
            {t.board?.players || 'Players'}
          </p>
          <ul className="max-h-28 space-y-1 overflow-y-auto text-xs lg:max-h-72">
            {realPlayers.length === 0 && (
              <li className="px-2 py-2 text-white/30">—</li>
            )}
            {realPlayers.map((p) => (
              <li
                key={p.id}
                className={clsx(
                  'flex items-center justify-between rounded px-2 py-1',
                  p.isYou && 'bg-equb-500/15',
                  p.status === 'won' && 'bg-gold-500/15',
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {p.name}
                    {p.isYou ? ' · you' : ''}
                  </p>
                  <p className="font-mono text-[10px] text-white/40">
                    {(p.picks || []).map((x) => String(x).padStart(2, '0')).join(' ')}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase text-gold-400">
                  {p.status === 'waiting' && (t.board?.waiting || '…')}
                  {p.status === 'won' && (t.board?.won || 'WIN')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <aside className="order-3">
        <div className="rounded-xl border border-white/10 bg-[#0a1210] p-2">
          <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-equb-400">
            {t.board?.results || 'ውጤቶች'}
          </p>
          <ul className="flex max-h-28 gap-1.5 overflow-x-auto pb-1 font-mono text-[10px] lg:max-h-72 lg:flex-col lg:space-y-1 lg:overflow-y-auto">
            {realResults.length === 0 && (
              <li className="px-2 py-2 text-white/30">
                {t.board?.noResults || '—'}
              </li>
            )}
            {realResults.slice(0, 12).map((r) => (
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

      <style jsx>{`
        @keyframes winnerPop {
          0% {
            transform: scale(0.85);
          }
          60% {
            transform: scale(1.15);
          }
          100% {
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}
