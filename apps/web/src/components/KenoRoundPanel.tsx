'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { api, isApiConfigured } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { cryptoShuffle, KENO_POOL_SIZE } from '@/lib/keno-engine';

type PublicRound = {
  id: string;
  roundNumber: number;
  status: 'open' | 'closed' | 'settled';
  secondsLeft: number;
  drawn: number[] | null;
  resultHash: string | null;
  betCount: number;
  totalStake: number;
  totalPayout: number;
  bets: Array<{
    playerName: string;
    picks: number[];
    betAmount: number;
    matchCount?: number;
    winAmount?: number;
  }>;
};

export function KenoRoundPanel({
  balance,
  minBet = 0.2,
  maxBet = 100,
}: {
  balance?: number | null;
  minBet?: number;
  maxBet?: number;
}) {
  const { token } = useAuth();
  const [round, setRound] = useState<PublicRound | null>(null);
  const [history, setHistory] = useState<PublicRound[]>([]);
  const [picks, setPicks] = useState<number[]>([]);
  const [bet, setBet] = useState(Math.max(1, minBet));
  const [spotTarget, setSpotTarget] = useState(10);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pollErr, setPollErr] = useState('');

  const refresh = useCallback(async () => {
    if (!isApiConfigured()) {
      setPollErr('Set NEXT_PUBLIC_API_URL and deploy API for live rounds');
      return;
    }
    try {
      const [cur, hist] = await Promise.all([
        api<PublicRound>('/keno/rounds/current'),
        api<PublicRound[]>('/keno/rounds/history'),
      ]);
      setRound(cur);
      setHistory(Array.isArray(hist) ? hist : []);
      setPollErr('');
    } catch (e: any) {
      setPollErr(e?.message || 'Cannot reach rounds API');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 2000);
    return () => clearInterval(t);
  }, [refresh]);

  const toggle = (n: number) => {
    if (busy || round?.status !== 'open') return;
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= spotTarget) return prev;
      return [...prev, n].sort((a, b) => a - b);
    });
  };

  const place = async () => {
    if (!token) {
      setErr('Log in to bet on rounds');
      return;
    }
    if (picks.length < 1) {
      setErr('Select numbers first');
      return;
    }
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const res = await api<{ message: string; round: PublicRound }>('/keno/rounds/bet', {
        method: 'POST',
        token,
        body: JSON.stringify({ picks, betAmount: bet }),
      });
      setMsg(res.message);
      setRound(res.round);
      setPicks([]);
    } catch (e: any) {
      setErr(e?.message || 'Bet failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
        ROUND mode · shared timer · one draw for all · server CSPRNG
      </div>
      {pollErr && <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200">{pollErr}</p>}
      {round && (
        <div className="rounded-2xl border border-white/10 bg-surface-900/80 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/40">Round</p>
              <p className="text-2xl font-black">#{round.roundNumber}</p>
            </div>
            <div className="text-right">
              <p
                className={clsx(
                  'rounded-full px-3 py-1 text-xs font-bold uppercase',
                  round.status === 'open' && 'bg-emerald-500/20 text-emerald-400',
                  round.status === 'closed' && 'bg-amber-500/20 text-amber-400',
                  round.status === 'settled' && 'bg-white/10 text-white/50',
                )}
              >
                {round.status}
              </p>
              {round.status === 'open' && (
                <p className="mt-1 font-mono text-lg text-gold-400">{round.secondsLeft}s</p>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-white/40">
            {round.betCount} bets · stake {round.totalStake.toFixed(2)}
            {round.status === 'settled' && ` · paid ${round.totalPayout.toFixed(2)}`}
          </p>
          {round.drawn && (
            <p className="mt-3 font-mono text-xs leading-relaxed text-white/80">
              {round.drawn.map((n) => String(n).padStart(2, '0')).join(' ')}
            </p>
          )}
        </div>
      )}

      {round?.status === 'open' && (
        <>
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
            {Array.from({ length: 80 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => toggle(n)}
                className={clsx(
                  'aspect-square rounded-lg text-xs font-bold',
                  picks.includes(n) ? 'bg-apex-500 text-white' : 'bg-white/10 text-white/70',
                )}
              >
                {String(n).padStart(2, '0')}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const pool = cryptoShuffle(Array.from({ length: KENO_POOL_SIZE }, (_, i) => i + 1));
                setPicks(pool.slice(0, spotTarget).sort((a, b) => a - b));
              }}
              className="rounded-xl border border-white/15 px-4 py-2 text-xs"
            >
              Quick pick
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
              disabled={busy || picks.length < 1}
              onClick={() => void place()}
              className="flex-1 rounded-xl bg-apex-500 py-2.5 text-sm font-bold disabled:opacity-40"
            >
              {busy ? 'Locking…' : `Lock bet · ${picks.length} spots`}
            </button>
          </div>
          {balance != null && (
            <p className="text-xs text-white/40">Balance {balance.toLocaleString()} (virtual)</p>
          )}
        </>
      )}

      {err && <p className="text-xs text-red-300">{err}</p>}
      {msg && <p className="text-xs text-emerald-300">{msg}</p>}

      {round && round.bets.length > 0 && (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-white/70">
          {round.bets.map((b, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>
                {b.playerName} · {b.picks.length} spots
                {b.matchCount != null ? ` · ${b.matchCount} hits` : ''}
              </span>
              <span>
                {b.winAmount != null ? (b.winAmount > 0 ? `+${b.winAmount}` : '0') : b.betAmount}
              </span>
            </li>
          ))}
        </ul>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase text-white/30">Past draws</p>
          {history.slice(0, 5).map((h) => (
            <div key={h.id} className="rounded-xl bg-white/5 px-3 py-2 text-[11px] font-mono text-white/60">
              #{h.roundNumber}{' '}
              {h.drawn?.slice(0, 8).map((n) => String(n).padStart(2, '0')).join(' ')}…
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
