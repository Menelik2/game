'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !user.isAdmin)) router.push('/');
  }, [loading, user, router]);

  const { data } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api<any>('/admin/dashboard', { token: token! }),
    enabled: !!token && !!user?.isAdmin,
  });

  if (loading || !user?.isAdmin) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-white/50">Demo mode metrics</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl p-6">
          <p className="text-xs text-white/50">Users</p>
          <p className="mt-1 text-3xl font-bold">{data?.registeredUsers ?? '—'}</p>
        </div>
        <div className="glass rounded-2xl p-6">
          <p className="text-xs text-white/50">Active games</p>
          <p className="mt-1 text-3xl font-bold">{data?.activeGames ?? '—'}</p>
        </div>
        <div className="glass rounded-2xl p-6">
          <p className="text-xs text-white/50">Transactions</p>
          <p className="mt-1 text-3xl font-bold">{data?.totalTransactions ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
