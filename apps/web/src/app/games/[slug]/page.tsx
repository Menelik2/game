'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useState } from 'react';
import Link from 'next/link';

function uuid() {
  return crypto.randomUUID();
}

export default function GamePlayPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, token } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bet, setBet] = useState(1);
  const [lastResult, setLastResult] = useState<any>(null);
  const [error, setError] = useState('');

  const { data: game, isLoading } = useQuery({
    queryKey: ['game', slug],
    queryFn: () => api<any>(`/games/${slug}`),
  });

  const startMutation = useMutation({
    mutationFn: () => api<any>(`/games/${game.id}/start`, { method: 'POST', token: token! }),
    onSuccess: (res) => setSessionId(res.sessionId),
  });

  const playMutation = useMutation({
    mutationFn: () =>
      api<any>(`/games/${game.id}/play`, {
        method: 'POST',
        token: token!,
        body: JSON.stringify({
          sessionId,
          betAmount: bet,
          idempotencyKey: uuid(),
        }),
      }),
    onSuccess: (res) => {
      setLastResult(res);
      setError('');
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (e: any) => setError(e.message || 'Play failed'),
  });

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-white/40">Loading game…</div>;
  }

  if (!game) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-white/40">Game not found</p>
        <Link href="/games" className="mt-4 inline-block text-apex-400">Back to lobby</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/games" className="text-sm text-white/50 hover:text-white">← Lobby</Link>
      <h1 className="mt-2 text-3xl font-bold">{game.name}</h1>
      <p className="text-white/50">{game.category} · {game.provider?.name || 'Apex Studios'}</p>
      <p className="mt-1 text-xs text-amber-400/80">Demo — virtual credits · server-authoritative outcomes</p>

      <div className="mt-8 glass rounded-3xl p-8">
        {!user ? (
          <div className="text-center">
            <p className="text-white/60">Sign in to play</p>
            <button onClick={() => router.push('/login')} className="mt-4 rounded-full bg-apex-500 px-6 py-2.5 text-sm font-semibold">
              Log in
            </button>
          </div>
        ) : !sessionId ? (
          <div className="text-center">
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="rounded-full bg-gradient-to-r from-apex-500 to-apex-600 px-8 py-3 font-semibold shadow-glow disabled:opacity-50"
            >
              {startMutation.isPending ? 'Starting…' : 'Start session'}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="text-xs text-white/50">Bet amount</label>
                <input
                  type="number"
                  min={game.minBet || 0.1}
                  max={game.maxBet || 100}
                  step={0.1}
                  value={bet}
                  onChange={(e) => setBet(Number(e.target.value))}
                  className="mt-1 w-32 rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={() => playMutation.mutate()}
                disabled={playMutation.isPending}
                className="rounded-full bg-gradient-to-r from-apex-500 to-apex-600 px-8 py-2.5 font-semibold shadow-glow disabled:opacity-50"
              >
                {playMutation.isPending ? 'Playing…' : 'Play'}
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
            )}

            {lastResult && (
              <div className="rounded-2xl border border-white/10 bg-surface-800/80 p-5 text-sm">
                <p>
                  Bet: <strong>{lastResult.betAmount}</strong> · Win:{' '}
                  <strong className={lastResult.winAmount > 0 ? 'text-emerald-400' : ''}>
                    {lastResult.winAmount}
                  </strong>
                </p>
                <p className="mt-1 text-white/50">Balance: {lastResult.balance}</p>
                <pre className="mt-3 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-white/60">
                  {JSON.stringify(lastResult.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
