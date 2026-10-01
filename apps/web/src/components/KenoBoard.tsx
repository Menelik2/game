'use client';

import { useMemo, useState, useCallback } from 'react';
import clsx from 'clsx';
import {
  KENO_PAYTABLE,
  KENO_POOL_SIZE,
  cryptoShuffle,
} from '@/lib/keno-engine';

type BetResult = {
  drawn: number[];
  hits: number[];
  hitCount: number;
  winAmount: number;
  balance?: number;
  mode?: 'demo' | 'server';
};

type Props = {
  minBet?: number;
  maxBet?: number;
  balance?: number | null;
  onBet: (picks: number[], amount: number) => Promise<BetResult | null>;
  disabled?: boolean;
  sourceLabel?: string;
};

export function KenoBoard({
  minBet = 0.2,
  maxBet = 100,
  balance,
  onBet,
  disabled,
  sourceLabel,
}: Props) {
  const [picks, setPicks] = useState<number[]>([]);
  const [bet, setBet] = useState(Math.max(1, minBet));
  const [drawn, setDrawn] = useState<number[]>([]);
  const [hits, setHits] = useState<number[]>([]);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [lastMode, setLastMode] = useState<'demo' | 'server' | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [spotTarget, setSpotTarget] = useState(10);
  const [history, setHistory] = useState<{ hitCount: number; win: number; mode: string }[]>([]);

  const hitSet = useMemo(() => new Set(hits), [hits]);
  const drawnSet = useMemo(() => new Set(drawn), [drawn]);

  const maxPossible = useMemo(() => {
    if (picks.length === 0) return 0;
    const row = KENO_PAYTABLE[picks.length] || {};
    const maxMult = Math.max(0, ...Object.values(row));
    return Math.round(bet * maxMult * 100) / 100;
  }, [picks.length, bet]);

  const toggle = (n: number) => {
    if (busy || disabled) return;
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
    if (busy) return;
    const pool = cryptoShuffle(Array.from({ length: KENO_POOL_SIZE }, (_, i) => i + 1));
    setPicks(pool.slice(0, spotTarget).sort((a, b) => a - b));
    setDrawn([]);
    setHits([]);
    setLastWin(null);
    setErr('');
  }, [spotTarget, busy]);

  const clear = () => {
    if (busy) return;
    setPicks([]);
    setDrawn([]);
    setHits([]);
    setLastWin(null);
    setErr('');
  };

  const placeBet = async () => {
    if (picks.length < 1) {
      setErr('Choose at least 1 number');
      return;
    }
    if (balance != null && bet > balance) {
      setErr('Insufficient balance');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const result = await onBet(picks, bet);
      if (!result) {
        setErr('Bet failed');
        return;
      }
      setDrawn(result.drawn);
      setHits(result.hits);
      setLastWin(result.winAmount);
      setLastMode(result.mode || null);
      setHistory((h) =>
        [{ hitCount: result.hitCount, win: result.winAmount, mode: result.mode || 'demo' }, ...h].slice(0, 8),
      );
    } catch (e: any) {
      setErr(e?.message || 'Bet failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {sourceLabel && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/50">
          {sourceLabel}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[1, 5, 8, 10].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSpotTarget(s);
              setPicks((p) => p.slice(0, s));
            }}
            className={clsx(
              'rounded-full px-3 py-1 text-xs',
              spotTarget === s ? 'bg-apex-500 text-white' : 'bg-white/5 text-white/50',
            )}
          >
            {s} spots
          </button>
        ))}
      </div>

      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
        {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => {
          const selected = picks.includes(n);
          const isHit = hitSet.has(n);
          const isDrawn = drawnSet.has(n);
          return (
            <button
              key={n}
              type="button"
              disabled={busy || disabled}
              onClick={() => toggle(n)}
              className={clsx(
                'aspect-square rounded-lg text-xs font-bold transition',
                isHit && 'bg-gold-500 text-black ring-2 ring-gold-300',
                !isHit && isDrawn && 'bg-white/20 text-white/80',
                !isDrawn && selected && 'bg-apex-500 text-white',
                !isDrawn && !selected && 'bg-white/10 text-white/70',
              )}
            >
              {String(n).padStart(2, '0')}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={quickPick} className="rounded-xl border border-white/15 px-4 py-2 text-xs">
          Quick pick
        </button>
        <button type="button" onClick={clear} className="rounded-xl border border-white/15 px-4 py-2 text-xs">
          Clear
        </button>
        <input
          type="number"
          min={minBet}
          max={maxBet}
          step={0.2}
          value={bet}
          onChange={(e) => setBet(Number(e.target.value) || minBet)}
          className="w-24 rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy || picks.length < 1 || disabled}
          onClick={() => void placeBet()}
          className="flex-1 rounded-xl bg-gradient-to-r from-apex-500 to-apex-600 py-2.5 text-sm font-bold disabled:opacity-40"
        >
          {busy ? 'Drawing…' : `Play · ${picks.length} spots`}
        </button>
      </div>

      {balance != null && (
        <p className="text-xs text-white/40">
          Balance {balance.toLocaleString()} · max win ~{maxPossible}
        </p>
      )}
      {err && <p className="text-xs text-red-300">{err}</p>}

      {drawn.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-[10px] uppercase tracking-wider text-white/40">
            Draw ({drawn.length}){lastMode ? ` · ${lastMode}` : ''}
          </p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-white/80">
            {drawn.map((n) => String(n).padStart(2, '0')).join(' ')}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm">
              Hits: <span className="font-bold text-gold-400">{hits.length}</span>
              {hits.length > 0 && (
                <span className="ml-2 font-mono text-xs text-gold-400/80">
                  ({hits.map((n) => String(n).padStart(2, '0')).join(' ')})
                </span>
              )}
            </p>
            {lastWin != null && (
              <p
                className={clsx(
                  'rounded-full px-3 py-1 text-sm font-bold',
                  lastWin > 0 ? 'bg-gold-500/20 text-gold-400' : 'bg-white/10 text-white/50',
                )}
              >
                {lastWin > 0 ? `+${lastWin}` : 'No win'}
              </p>
            )}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {history.map((h, i) => (
            <span
              key={i}
              className={clsx(
                'rounded-lg px-2 py-1 text-[10px] font-mono',
                h.win > 0 ? 'bg-gold-500/15 text-gold-400' : 'bg-white/5 text-white/40',
              )}
            >
              {h.hitCount}h · {h.win > 0 ? `+${h.win}` : '0'}
            </span>
          ))}
        </div>
      )}

      {picks.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase text-white/30">Paytable · {picks.length} spots</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(KENO_PAYTABLE[picks.length] || {}).map(([hitsNeeded, mult]) => (
              <span key={hitsNeeded} className="text-[11px] text-white/50">
                {hitsNeeded}× → <span className="text-gold-400/90">{mult}×</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
