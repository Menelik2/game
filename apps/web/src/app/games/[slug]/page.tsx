'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { api, isApiConfigured } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { randomUUID } from '@/lib/uuid';
import { getDemoGameBySlug } from '@/lib/demo-games';
import { KenoBoard } from '@/components/KenoBoard';
import { KenoRoundPanel } from '@/components/KenoRoundPanel';
import { localKenoPlay } from '@/lib/keno-engine';

export default function GamePlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, token } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(1);
  const [lastResult, setLastResult] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(1000);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState('');
  const [kenoMode, setKenoMode] = useState<'instant' | 'round'>('instant');

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', slug],
    queryFn: async () => {
      try {
        return await api<any>(`/games/${slug}`);
      } catch {
        const demo = getDemoGameBySlug(slug);
        if (demo) return demo;
        throw new Error('Game not found');
      }
    },
  });

  const startSession = useMutation({
    mutationFn: () =>
      api<{ sessionId: string; minBet: number; maxBet: number }>(`/games/${game.id}/start`, {
        method: 'POST',
        token: token!,
      }),
    onSuccess: (data) => {
      setError('');
      setSessionId(data.sessionId);
      setBetAmount(data.minBet ?? 1);
      setLastResult(null);
    },
    onError: (err: any) => setError(err?.message || 'Could not start session'),
  });

  const play = useMutation({
    mutationFn: () =>
      api<any>(`/games/${game.id}/play`, {
        method: 'POST',
        token: token!,
        body: JSON.stringify({
          sessionId,
          betAmount,
          idempotencyKey: randomUUID(),
        }),
      }),
    onSuccess: (data) => {
      setError('');
      setLastResult(data);
      if (typeof data.balance === 'number') setBalance(data.balance);
      qc.invalidateQueries({ queryKey: ['wallet'] });
      setSpinning(false);
    },
    onError: (err: any) => {
      setSpinning(false);
      setError(err?.message || 'Play failed');
    },
  });

  const handleKenoBet = useCallback(
    async (picks: number[], amount: number) => {
      if (token && game?.id && !String(game.id).startsWith('demo-') && isApiConfigured()) {
        let sid = sessionId;
        if (!sid) {
          const s = await api<{ sessionId: string }>(`/games/${game.id}/start`, {
            method: 'POST',
            token,
          });
          sid = s.sessionId;
          setSessionId(sid);
        }
        const data = await api<any>(`/games/${game.id}/play`, {
          method: 'POST',
          token,
          body: JSON.stringify({
            sessionId: sid,
            betAmount: amount,
            idempotencyKey: randomUUID(),
            picks,
          }),
        });
        const result = data.result || data;
        if (typeof data.balance === 'number') setBalance(data.balance);
        qc.invalidateQueries({ queryKey: ['wallet'] });
        return {
          drawn: result.drawn as number[],
          hits: result.hits as number[],
          hitCount: result.hitCount as number,
          winAmount: Number(data.win ?? data.winAmount ?? result.winAmount ?? 0),
          balance: data.balance,
          mode: 'server' as const,
        };
      }
      const local = localKenoPlay(picks, amount);
      setBalance((b) => Math.max(0, (b ?? 1000) - amount + local.winAmount));
      return {
        drawn: local.drawn,
        hits: local.hits,
        hitCount: local.hitCount,
        winAmount: local.winAmount,
        mode: 'demo' as const,
      };
    },
    [token, game, sessionId, qc],
  );

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-white/50">Loading game…</div>;
  }
  if (!game) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-white/50">Game not found</p>
        <Link href="/games" className="mt-4 inline-block text-apex-400">Back to lobby</Link>
      </div>
    );
  }

  if (game.category === 'KENO') {
    return (
      <div className="mx-auto max-w-lg px-3 py-6 pb-24">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/games" className="text-sm text-white/50 hover:text-white">← Lobby</Link>
          <span className="text-xs text-white/30">{game.name}</span>
        </div>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setKenoMode('instant')}
            className={
              kenoMode === 'instant'
                ? 'flex-1 rounded-full bg-apex-500 py-2 text-xs font-bold'
                : 'flex-1 rounded-full bg-white/5 py-2 text-xs text-white/50'
            }
          >
            Instant play
          </button>
          <button
            type="button"
            onClick={() => setKenoMode('round')}
            className={
              kenoMode === 'round'
                ? 'flex-1 rounded-full bg-violet-500 py-2 text-xs font-bold'
                : 'flex-1 rounded-full bg-white/5 py-2 text-xs text-white/50'
            }
          >
            Round draw
          </button>
        </div>
        {kenoMode === 'instant' ? (
          <KenoBoard
            minBet={Number(game.minBet) || 0.2}
            maxBet={Number(game.maxBet) || 100}
            balance={balance}
            onBet={handleKenoBet}
            sourceLabel={
              token && game?.id && !String(game.id).startsWith('demo-') && isApiConfigured()
                ? 'LIVE — server RNG + wallet'
                : 'DEMO — crypto draw · virtual balance'
            }
          />
        ) : (
          <KenoRoundPanel
            balance={balance}
            minBet={Number(game.minBet) || 0.2}
            maxBet={Number(game.maxBet) || 100}
          />
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">{game.name}</h1>
        <p className="mt-2 text-white/50">Sign in to play with demo credits</p>
        <button onClick={() => router.push('/login')} className="mt-6 rounded-full bg-apex-500 px-8 py-3 font-semibold">
          Log in to play
        </button>
      </div>
    );
  }

  const winAmount = Number(lastResult?.win ?? lastResult?.winAmount ?? 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/games" className="text-sm text-white/50 hover:text-white">← Lobby</Link>
      <h1 className="mt-2 text-3xl font-bold">{game.name}</h1>
      <p className="text-white/50">{game.category}</p>
      <div className="mt-8 glass rounded-3xl p-8">
        {lastResult && (
          <div className={`mb-6 rounded-2xl px-4 py-3 text-center text-sm ${winAmount > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-white/60'}`}>
            {winAmount > 0 ? `You won ${winAmount.toFixed(2)} DEMO!` : 'No win this round'}
          </div>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {!sessionId ? (
            <button onClick={() => startSession.mutate()} disabled={startSession.isPending}
              className="w-full rounded-xl bg-apex-500 py-3.5 font-semibold disabled:opacity-50">
              {startSession.isPending ? 'Starting…' : 'Start Session'}
            </button>
          ) : (
            <>
              <input type="number" min={game.minBet} max={game.maxBet} step="0.1" value={betAmount}
                onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
                className="flex-1 rounded-xl border border-white/10 bg-surface-800 px-4 py-3 text-sm" />
              <button onClick={() => { setSpinning(true); play.mutate(); }} disabled={play.isPending || spinning}
                className="rounded-xl bg-gold-500 px-10 py-3.5 font-bold text-black disabled:opacity-50">
                {spinning ? 'Playing…' : 'PLAY'}
              </button>
            </>
          )}
        </div>
        {error && <div className="mt-4 text-center text-sm text-red-300">{error}</div>}
      </div>
    </div>
  );
}
