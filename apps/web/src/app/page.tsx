'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { GameCard, GameCardProps } from '@/components/GameCard';
import { Play, Sparkles, Shield } from 'lucide-react';
import { filterDemoGames } from '@/lib/demo-games';

export default function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['games', 'home'],
    queryFn: async () => {
      try {
        const res = await api<{ items: GameCardProps[] }>('/games?limit=12&popular=true');
        if (res?.items?.length) return res.items;
      } catch {
        /* offline */
      }
      return filterDemoGames({ popular: true, limit: 12 }) as GameCardProps[];
    },
  });

  const games = data || [];

  return (
    <div>
      <section className="relative overflow-hidden bg-hero-glow">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-apex-500/30 bg-apex-500/10 px-3 py-1 text-xs font-medium text-apex-300">
              <Sparkles className="h-3.5 w-3.5" />
              Premium Social Casino · Demo Mode
            </div>
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">
              Play the house of <span className="text-gradient">tomorrow</span>
            </h1>
            <p className="mt-4 text-lg text-white/60">
              Original games, server-authoritative fairness, and a luxury experience — powered by
              virtual credits. No real money required.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/games"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-apex-500 to-apex-600 px-8 py-3.5 text-base font-semibold shadow-glow transition hover:from-apex-400 hover:to-apex-500"
              >
                <Play className="h-5 w-5" fill="currentColor" />
                Play Now
              </Link>
              <Link
                href="/games"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 py-3.5 text-base font-semibold backdrop-blur transition hover:bg-white/10"
              >
                Explore Games
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Popular Games</h2>
            <p className="text-sm text-white/50">Most played right now</p>
          </div>
          <Link href="/games?category=POPULAR" className="text-sm text-apex-400 hover:underline">
            View all
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-surface-700" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {games.map((g) => (
              <GameCard key={g.id || g.slug} {...g} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="mb-4 text-xl font-bold">Categories</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {['Slots', 'Roulette', 'Blackjack', 'Jackpot', 'Crash', 'Live'].map((cat) => (
            <Link
              key={cat}
              href={`/games?category=${cat.toUpperCase()}`}
              className="flex items-center justify-center rounded-2xl border border-white/10 bg-surface-800 py-6 text-sm font-semibold transition hover:border-apex-500/50 hover:bg-surface-700"
            >
              {cat}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="glass rounded-3xl p-8 md:p-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-emerald-500/20 p-3">
                <Shield className="h-8 w-8 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Play responsibly</h2>
                <p className="mt-1 max-w-xl text-sm text-white/60">
                  Set limits, take breaks, or self-exclude anytime. Demo environment with virtual
                  credits only.
                </p>
              </div>
            </div>
            <Link
              href="/responsible-gambling"
              className="shrink-0 rounded-full border border-emerald-500/40 px-6 py-2.5 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10"
            >
              Learn more
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-white/40">
          <p>© {new Date().getFullYear()} Apex Casino. Demo platform — virtual currency only.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-4">
            <Link href="/terms" className="hover:text-white/70">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-white/70">
              Privacy
            </Link>
            <Link href="/responsible-gambling" className="hover:text-white/70">
              Responsible Gambling
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
