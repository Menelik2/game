'use client';

import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { GameCard, GameCardProps } from '@/components/GameCard';
import { Suspense } from 'react';
import { filterDemoGames } from '@/lib/demo-games';

function GamesContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get('category') || undefined;
  const search = searchParams.get('q') || undefined;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['games', category, search],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (search) params.set('search', search);
        params.set('limit', '48');
        const res = await api<{ items: GameCardProps[] }>(`/games?${params}`);
        if (res?.items?.length) return { items: res.items, source: 'api' as const };
      } catch {
        /* API offline */
      }
      return {
        items: filterDemoGames({ category, search, limit: 48 }) as GameCardProps[],
        source: 'demo' as const,
      };
    },
    retry: 1,
  });

  const games = data?.items || [];
  const usingDemo = data?.source === 'demo' || isError;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold">Game Lobby</h1>
      <p className="mt-1 text-white/50">Discover slots, table games, and more</p>

      {usingDemo && !isLoading && (
        <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200/90">
          Showing demo catalog. Connect and seed the API for live play &amp; balances.
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {['All', 'Popular', 'New', 'Slots', 'Roulette', 'Blackjack', 'Crash', 'Jackpot'].map(
          (c) => {
            const val = c === 'All' ? undefined : c.toUpperCase();
            const active = (category || undefined) === val;
            return (
              <a
                key={c}
                href={val ? `/games?category=${val}` : '/games'}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-apex-500 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                {c}
              </a>
            );
          },
        )}
      </div>

      {isLoading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-surface-700" />
          ))}
        </div>
      ) : games.length === 0 ? (
        <p className="mt-12 text-center text-white/40">No games match this filter.</p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {games.map((g) => (
            <GameCard key={g.id || g.slug} {...g} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GamesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-center text-white/50">Loading…</div>
      }
    >
      <GamesContent />
    </Suspense>
  );
}
