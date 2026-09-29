'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function WalletPage() {
  const { user, token, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api<any>('/wallet', { token: token! }),
    enabled: !!token,
  });

  const { data: txs } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => api<{ items: any[] }>('/wallet/transactions?limit=20', { token: token! }),
    enabled: !!token,
  });

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">Wallet</h1>
      <p className="mt-1 text-sm text-amber-400/80">Demo mode — virtual credits only</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl p-5">
          <p className="text-xs text-white/50">Available</p>
          <p className="mt-1 text-2xl font-bold text-gold-400">
            {wallet ? Number(wallet.availableBalance).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
          </p>
          <p className="text-xs text-white/40">DEMO</p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs text-white/50">Locked</p>
          <p className="mt-1 text-2xl font-bold">
            {wallet ? Number(wallet.lockedBalance).toLocaleString() : '—'}
          </p>
        </div>
        <div className="glass rounded-2xl p-5">
          <p className="text-xs text-white/50">Bonus</p>
          <p className="mt-1 text-2xl font-bold">
            {wallet ? Number(wallet.bonusBalance).toLocaleString() : '—'}
          </p>
        </div>
      </div>

      <h2 className="mt-10 text-xl font-semibold">Recent transactions</h2>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {(txs?.items || []).map((t) => (
              <tr key={t.id} className="border-t border-white/5">
                <td className="px-4 py-3">{t.type}</td>
                <td className="px-4 py-3">{Number(t.amount).toFixed(2)} {t.currency}</td>
                <td className="px-4 py-3">{t.status}</td>
                <td className="px-4 py-3 text-white/50">{new Date(t.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {(!txs?.items || txs.items.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-white/40">No transactions yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
