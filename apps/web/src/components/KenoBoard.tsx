'use client';

import { useMemo, useState, useCallback } from 'react';
import clsx from 'clsx';

const PAYTABLE: Record<number, Record<number, number>> = {
  1: { 1: 3 },
  2: { 2: 12 },
  3: { 2: 1.5, 3: 40 },
  4: { 2: 1, 3: 5, 4: 80 },
  5: { 3: 2, 4: 15, 5: 200 },
  6: { 3: 1, 4: 5, 5: 50, 6: 500 },
  7: { 4: 2, 5: 15, 6: 100, 7: 1000 },
  8: { 5: 5, 6: 40, 7: 200, 8: 2000 },
  9: { 5: 2, 6: 15, 7: 80, 8: 500, 9: 5000 },
  10: { 5: 1, 6: 5, 7: 25, 8: 150, 9: 1000, 10: 10000 },
};

type Props = {
  minBet?: number;
  maxBet?: number;
  balance?: number | null;
  onBet: (picks: number[], amount: number) => Promise<{
    drawn: number[];
    hits: number[];
    hitCount: number;
    winAmount: number;
    balance?: number;
  } | null>;
  disabled?: boolean;
};

export function KenoBoard({ minBet = 0.2, maxBet = 100, balance, onBet, disabled }: Props) {
  const [picks, setPicks] = useState<number[]>([]);
  const [bet, setBet] = useState(Math.max(1, minBet));
  const [drawn, setDrawn] = useState<number[]>([]);
  const [hits, setHits] = useState<number[]>([]);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [spotTarget, setSpotTarget] = useState(10);

  const toggle = (n: number) => {
    if (busy) return;
    setLastWin(null);
    setDrawn([]);
    setHits([]);
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= spotTarget) return prev;
      return [...prev, n].sort((a, b) => a - b);
    });
  };

  const quickPick = useCallback(() => {
    const pool = Array.from({ length: 80 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setPicks(pool.slice(0, spotTarget).sort((a, b) => a - b));
    setDrawn([]);
    setHits([]);
    setLastWin(null);
  }, [spotTarget]);

  const clear = () => {
    setPicks([]);
    setDrawn([]);
    setHits([]);
    setLastWin(null);
  };

  const placeBet = async () => {
    if (picks.length < 1) {
      setErr('Choose at least 1 number');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const res = await onBet(picks, bet);
      if (res) {
        setDrawn(res.drawn);
        setHits(res.hits);
        setLastWin(res.winAmount);
      }
    } catch (e: any) {
      setErr(e?.message || 'Bet failed');
    } finally {
      setBusy(false);
    }
  };

  const drawnSet = useMemo(() => new Set(drawn), [drawn]);
  const hitSet = useMemo(() => new Set(hits), [hits]);
  const pickSet = useMemo(() => new Set(picks), [picks]);
  const maxMult = PAYTABLE[picks.length]?.[picks.length] ?? 0;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-950/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-black tracking-wide text-black">
            FAST KENO
          </span>
          <span className="text-xs text-white/40">1–80 · draw 20</span>
        </div>
        {balance != null && (
          <span className="text-sm font-semibold text-emerald-300">{balance.toFixed(2)} DEMO</span>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-white/10 bg-surface-800/80 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-lg font-black text-black">
            {picks.length}
          </span>
          <div>
            <p className="font-semibold text-white">Choose up to {spotTarget} numbers</p>
            <p className="text-sm text-emerald-400/90">From 1 to 80 · {picks.length} selected</p>
          </div>
          <div className="ml-auto flex gap-1">
            {[5, 8, 10].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setSpotTarget(n);
                  setPicks((p) => p.slice(0, n));
                }}
                className={clsx(
                  'h-8 w-8 rounded-full text-xs font-bold',
                  spotTarget === n ? 'bg-emerald-500 text-black' : 'bg-white/10 text-white/60',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-10 gap-1.5 rounded-2xl border border-white/5 bg-black/40 p-2">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
          const selected = pickSet.has(n);
          const isDrawn = drawnSet.has(n);
          const isHit = hitSet.has(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => toggle(n)}
              disabled={busy || (!selected && picks.length >= spotTarget)}
              className={clsx(
                'aspect-square rounded-lg text-xs font-semibold transition sm:text-sm',
                isHit && 'bg-emerald-500 text-black ring-2 ring-emerald-300',
                !isHit && isDrawn && 'bg-white/20 text-white/70',
                !isDrawn && selected && 'bg-emerald-600/80 text-white ring-1 ring-emerald-400',
                !isDrawn && !selected && 'bg-surface-700 text-white/80 hover:bg-surface-600',
              )}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={quickPick} className="flex-1 rounded-xl border border-white/10 py-2 text-sm font-medium text-white/70 hover:bg-white/5">
          Quick pick
        </button>
        <button type="button" onClick={clear} className="flex-1 rounded-xl border border-white/10 py-2 text-sm font-medium text-white/70 hover:bg-white/5">
          Clear
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={() => setBet((b) => Math.max(minBet, Math.round((b - 1) * 100) / 100))} className="h-12 w-12 rounded-xl bg-surface-700 text-xl font-bold">−</button>
        <div className="flex-1 rounded-xl border border-white/10 bg-surface-800 py-3 text-center text-xl font-bold">{bet}</div>
        <button type="button" onClick={() => setBet((b) => Math.min(maxBet, Math.round((b + 1) * 100) / 100))} className="h-12 w-12 rounded-xl bg-surface-700 text-xl font-bold">+</button>
        <button type="button" onClick={() => setBet((b) => Math.min(maxBet, Math.round(b * 2 * 100) / 100))} className="h-12 rounded-xl bg-surface-700 px-4 text-sm font-bold">×2</button>
        <button type="button" onClick={() => setBet(maxBet)} className="h-12 rounded-xl bg-surface-700 px-4 text-sm font-bold">MAX</button>
      </div>

      {picks.length > 0 && (
        <p className="mt-2 text-center text-xs text-white/40">Max multiplier for {picks.length} spots: ×{maxMult}</p>
      )}

      {lastWin !== null && (
        <div className={clsx('mt-3 rounded-xl px-4 py-3 text-center text-sm font-semibold', lastWin > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-white/50')}>
          {lastWin > 0 ? `Hit ${hits.length}/${picks.length} · Won ${lastWin.toFixed(2)} DEMO` : `Hit ${hits.length}/${picks.length} · No win`}
        </div>
      )}

      {drawn.length > 0 && (
        <p className="mt-2 text-center text-[11px] text-white/30">Drawn: {drawn.join(', ')}</p>
      )}

      {err && <p className="mt-2 text-center text-sm text-red-400">{err}</p>}

      <button type="button" onClick={placeBet} disabled={busy || disabled || picks.length < 1}
        className="mt-4 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-4 text-lg font-black tracking-wide text-black shadow-lg disabled:opacity-40">
        {busy ? 'DRAWING…' : 'BET'}
      </button>

      <p className="mt-3 text-center text-[11px] text-white/30">Demo social casino · virtual credits · not real-money gambling</p>
    </div>
  );
}
