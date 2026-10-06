'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEqubStore } from '@/lib/store';
import { Landmark, RefreshCw, CheckCircle2, Clock, XCircle } from 'lucide-react';
import clsx from 'clsx';

type Deposit = {
  id: string;
  userId?: string;
  amount: number;
  status: string;
  phone?: string;
  createdAt?: string;
  confirmedAt?: string;
  transactionNumber?: string;
  currency?: string;
};

function isAdmin(user: unknown) {
  return (
    !!user &&
    typeof user === 'object' &&
    (user as { role?: string }).role === 'admin'
  );
}

export default function AdminDepositsPage() {
  const router = useRouter();
  const me = useEqubStore((s) => s.user);
  const [items, setItems] = useState<Deposit[]>([]);
  const [meta, setMeta] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    failed: 0,
    review: 0,
    todayVolume: 0,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/deposits', { cache: 'no-store' });
      const json = await res.json();
      if (json?.success) {
        setItems(json.data.items || []);
        setMeta({
          total: json.data.total || 0,
          pending: json.data.pending || 0,
          confirmed: json.data.confirmed || 0,
          failed: json.data.failed || 0,
          review: json.data.review || 0,
          todayVolume: json.data.todayVolume || 0,
        });
      }
    } catch {
      /* */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (me && !isAdmin(me)) router.replace('/');
  }, [me, router]);

  if (!me || !isAdmin(me)) {
    return (
      <p className="py-16 text-center text-sm text-white/40">Admin only</p>
    );
  }

  const cards = [
    { label: 'Total', value: meta.total, icon: Landmark },
    { label: 'Pending', value: meta.pending, icon: Clock },
    { label: 'Confirmed', value: meta.confirmed, icon: CheckCircle2 },
    { label: 'Failed', value: meta.failed, icon: XCircle },
    {
      label: 'Today volume',
      value: `${meta.todayVolume.toLocaleString()} ETB`,
      icon: Landmark,
    },
  ];

  return (
    <div className="space-y-5 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Deposit review</h2>
          <p className="text-sm text-white/40">
            Telebirr / Verify.ET wallet top-ups
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/60"
        >
          <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
          >
            <p className="text-[10px] uppercase text-white/40">{c.label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-amber-200">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        {items.length === 0 && (
          <p className="px-4 py-14 text-center text-sm text-white/35">
            No deposits yet.
          </p>
        )}
        {items.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3.5 last:border-0"
          >
            <div className="min-w-0">
              <p className="font-mono text-base font-bold text-gold-400">
                {Number(d.amount).toLocaleString()}{' '}
                {d.currency || 'ETB'}
              </p>
              <p className="text-[11px] text-white/40">
                {d.phone || d.userId?.slice(0, 10) || '—'}
                {d.transactionNumber
                  ? ` · txn ${d.transactionNumber}`
                  : ''}
              </p>
              <p className="text-[10px] text-white/25">
                {d.createdAt
                  ? new Date(d.createdAt).toLocaleString()
                  : d.id.slice(0, 12)}
              </p>
            </div>
            <span
              className={clsx(
                'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
                d.status === 'CONFIRMED' && 'bg-equb-500/20 text-equb-300',
                (d.status === 'PENDING' || d.status === 'PROCESSING') &&
                  'bg-orange-500/20 text-orange-300',
                d.status === 'FAILED' && 'bg-red-500/20 text-red-300',
                d.status === 'REVIEW_REQUIRED' &&
                  'bg-amber-500/20 text-amber-300',
              )}
            >
              {d.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
