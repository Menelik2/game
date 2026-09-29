'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { GameCard, GameCardProps } from '@/components/GameCard';
import { Play, Sparkles, Shield } from 'lucide-react';

export default function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['games', 'home'],
    queryFn: () => api<{ items: GameCardProps[] }>('/games?limit=12&popular=true'),
  });
  const games = data?.items || [];

  return (
    <div>
      <section className="relative overflow-hidden bg-hero-glow">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-apex-500/30 bg-apex-500/10 px-3 py-1 text-xs font-medium text-apex-300">
              <Sparkles className="h-3.5 w-3.5" /> Premium Social Casino · Demo Mode
            </div>
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">
              Play the house of <span className="text-gradient">tomorrow</span>
            </h1>
            <p className="mt-4 text-lg text-white/60">
              Original games, server-authoritative fairness — virtual credits only.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/games" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-apex-500 to-apex-600 px-8 py-3.5 font-semibold shadow-glow">
                <Play className="h-5 w-5" fill="currentColor" /> Play Now
              </Link>
              <Link href="/games" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-8 py-3.5 font-semibold">
                Explore Games
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-2xl font-bold">Popular Games</h2>
        {isLoading ? (
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-surface-700" />
            ))}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
            {games.map((g) => (
              <GameCard key={g.id} {...g} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="glass rounded-3xl p-8 flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="flex items-start gap-4">
            <Shield className="h-8 w-8 text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-xl font-bold">Play responsibly</h2>
              <p className="mt-1 text-sm text-white/60">Limits, self-exclusion, and demo-only credits.</p>
            </div>
          </div>
          <Link href="/responsible-gambling" className="rounded-full border border-emerald-500/40 px-6 py-2.5 text-sm font-semibold text-emerald-400">
            Learn more
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-10 text-center text-sm text-white/40">
        © {new Date().getFullYear()} Apex Casino. Demo — virtual currency only.
      </footer>
    </div>
  );
}
