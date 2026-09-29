'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { randomUUID } from '@/lib/uuid';

export default function GamePlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, token } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState(1);
  const [lastResult, setLastResult] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState('');
  const [betType, setBetType] = useState('red');
  const [betOn, setBetOn] = useState<'player' | 'banker' | 'tie'>('player');
  const [autoCashout, setAutoCashout] = useState(1.5);

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', slug],
    queryFn: () => api<any>(`/games/${slug}`),
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
    mutationFn: () => {
      const body: Record<string, unknown> = {
        sessionId,
        betAmount,
        idempotencyKey: randomUUID(),
      };
      if (game?.category === 'ROULETTE') body.betType = betType;
      if (game?.category === 'BACCARAT') body.betOn = betOn;
      if (game?.category === 'CRASH') body.autoCashout = autoCashout;
      if (game?.category === 'BLACKJACK') body.action = 'auto';
      return api<any>(`/games/${game.id}/play`, {
        method: 'POST',
        token: token!,
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data) => {
      setError('');
      setLastResult(data);
      setBalance(typeof data.balance === 'number' ? data.balance : null);
      qc.invalidateQueries({ queryKey: ['wallet'] });
      setSpinning(false);
    },
    onError: (err: any) => {
      setSpinning(false);
      setError(err?.message || 'Play failed');
    },
  });

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
  const result = lastResult?.result;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/games" className="text-sm text-white/50 hover:text-white">← Lobby</Link>
      <h1 className="mt-2 text-3xl font-bold">{game.name}</h1>
      <p className="text-white/50">{game.category} · {game.provider?.name || 'Apex Studios'}</p>
      <p className="mt-1 text-xs text-amber-400/80">Demo — virtual credits · crypto RNG</p>

      <div className="mt-8 glass rounded-3xl p-8">
        {lastResult && (
          <div className={`mb-6 rounded-2xl px-4 py-3 text-center text-sm ${
            winAmount > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-white/60'
          }`}>
            {winAmount > 0 ? `You won ${winAmount.toFixed(2)} DEMO!` : 'No win this round'}
            {typeof lastResult.balance === 'number' && ` · Balance: ${lastResult.balance.toFixed(2)} DEMO`}
          </div>
        )}

        {result && (
          <div className="mb-6 space-y-2 rounded-xl bg-black/40 p-4 text-sm text-white/70">
            {result.type === 'slots' && (
              <div>
                <p className="text-xs text-white/40 mb-1">Payline</p>
                <p className="font-mono text-lg tracking-widest">{(result.symbols as string[])?.join(' · ') || '—'}</p>
                {result.multiplier != null && <p className="mt-1 text-xs">Multiplier: ×{String(result.multiplier)}</p>}
              </div>
            )}
            {result.type === 'roulette' && (
              <p>Ball: <strong className="text-white">{String(result.number)}</strong> ({String(result.color)})</p>
            )}
            {result.type === 'crash' && (
              <p>Crash at <strong className="text-white">{String(result.crashPoint)}×</strong>
                {result.cashedOut ? ' · Cashed out' : ' · Busted'}</p>
            )}
            {result.type === 'blackjack' && (
              <div className="space-y-1">
                <p>You: {(result.playerCards as string[])?.join(' ')} = <strong>{String(result.playerTotal)}</strong></p>
                <p>Dealer: {(result.dealerCards as string[])?.join(' ')} = <strong>{String(result.dealerTotal)}</strong></p>
                <p className="capitalize">Outcome: {String(result.outcome)}</p>
              </div>
            )}
            {result.type === 'baccarat' && (
              <div className="space-y-1">
                <p>Player: {(result.playerCards as string[])?.join(' ')} = {String(result.playerTotal)}</p>
                <p>Banker: {(result.bankerCards as string[])?.join(' ')} = {String(result.bankerTotal)}</p>
                <p className="capitalize">Winner: {String(result.winner)}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4">
          {!sessionId ? (
            <button onClick={() => startSession.mutate()} disabled={startSession.isPending}
              className="w-full rounded-xl bg-gradient-to-r from-apex-500 to-apex-600 py-3.5 font-semibold disabled:opacity-50">
              {startSession.isPending ? 'Starting…' : 'Start Session'}
            </button>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs text-white/50">Bet amount (DEMO)</label>
                <input type="number" min={game.minBet} max={game.maxBet} step="0.1" value={betAmount}
                  onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-white/10 bg-surface-800 px-4 py-3 text-sm outline-none focus:border-apex-500" />
              </div>
              {game.category === 'ROULETTE' && (
                <div>
                  <label className="mb-1 block text-xs text-white/50">Bet on</label>
                  <select value={betType} onChange={(e) => setBetType(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-surface-800 px-4 py-3 text-sm">
                    <option value="red">Red (1:1)</option>
                    <option value="black">Black (1:1)</option>
                    <option value="even">Even (1:1)</option>
                    <option value="odd">Odd (1:1)</option>
                    <option value="low">Low 1–18 (1:1)</option>
                    <option value="high">High 19–36 (1:1)</option>
                  </select>
                </div>
              )}
              {game.category === 'BACCARAT' && (
                <div>
                  <label className="mb-1 block text-xs text-white/50">Bet on</label>
                  <select value={betOn} onChange={(e) => setBetOn(e.target.value as any)}
                    className="w-full rounded-xl border border-white/10 bg-surface-800 px-4 py-3 text-sm">
                    <option value="player">Player (1:1)</option>
                    <option value="banker">Banker (0.95:1)</option>
                    <option value="tie">Tie (8:1)</option>
                  </select>
                </div>
              )}
              {game.category === 'CRASH' && (
                <div>
                  <label className="mb-1 block text-xs text-white/50">Auto cashout</label>
                  <input type="number" min={1.01} max={100} step="0.1" value={autoCashout}
                    onChange={(e) => setAutoCashout(parseFloat(e.target.value) || 1.5)}
                    className="w-full rounded-xl border border-white/10 bg-surface-800 px-4 py-3 text-sm outline-none focus:border-apex-500" />
                </div>
              )}
              <button onClick={() => { setSpinning(true); play.mutate(); }}
                disabled={play.isPending || spinning}
                className="rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 px-10 py-3.5 font-bold text-black disabled:opacity-50">
                {spinning ? 'Playing…' : 'PLAY'}
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">{error}</div>
        )}
        {balance !== null && (
          <p className="mt-4 text-center text-sm text-white/40">
            Current balance: <strong className="text-white">{balance.toFixed(2)}</strong> DEMO
          </p>
        )}
      </div>
    </div>
  );
}
