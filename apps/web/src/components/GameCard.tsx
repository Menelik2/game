'use client';

import Link from 'next/link';
import { Heart, Play } from 'lucide-react';

export interface GameCardProps {
  id: string;
  slug: string;
  name: string;
  category: string;
  thumbnail?: string | null;
  isNew?: boolean;
  isPopular?: boolean;
  hasJackpot?: boolean;
  provider?: { name: string } | null;
  minBet?: number;
}

export function GameCard({
  slug,
  name,
  category,
  isNew,
  isPopular,
  hasJackpot,
  provider,
}: GameCardProps) {
  return (
    <Link
      href={`/games/${slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface-800 transition hover:border-apex-500/50 hover:shadow-glow"
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-apex-900/80 to-surface-700">
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl opacity-30">🎰</span>
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100 bg-black/50">
          <span className="flex items-center gap-2 rounded-full bg-apex-500 px-4 py-2 text-sm font-semibold shadow-glow">
            <Play className="h-4 w-4" fill="currentColor" /> Play
          </span>
        </div>
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {isNew && (
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase">New</span>
          )}
          {isPopular && (
            <span className="rounded-full bg-apex-500 px-2 py-0.5 text-[10px] font-bold uppercase">Hot</span>
          )}
          {hasJackpot && (
            <span className="rounded-full bg-gold-500 text-black px-2 py-0.5 text-[10px] font-bold uppercase">Jackpot</span>
          )}
        </div>
        <button
          className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 text-white/70 hover:text-red-400"
          onClick={(e) => e.preventDefault()}
        >
          <Heart className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold">{name}</h3>
        <p className="truncate text-xs text-white/50">
          {provider?.name || 'Apex Studios'} · {category}
        </p>
      </div>
    </Link>
  );
}
