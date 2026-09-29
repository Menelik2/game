'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { GameCard, GameCardProps } from '@/components/GameCard';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function FavoritesPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: () => api<{ items: GameCardProps[] }>('/favorites', { token: token! }),
    enabled: !!token,
  });

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-3xl font-bold">Favorites</h1>
      {isLoading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-surface-700" />
          ))}
        </div>
      ) : !data?.items?.length ? (
        <div className="mt-12 text-center">
          <p className="text-white/40">No favorites yet</p>
          <Link href="/games" className="mt-4 inline-block text-apex-400 hover:underline">Browse games</Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {data.items.map((g) => (
            <GameCard key={g.id} {...g} />
          ))}
        </div>
      )}
    </div>
  );
}
