'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEqubStore } from '@/lib/store';
import { adminFetch } from '@/lib/admin-fetch';
import {
  Landmark,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import clsx from 'clsx';

type Deposit = {
  id: string;
  userId?: string;
  amount: number;
  status: string;
  phone?: string;
  createdAt?: string;
  confirmedAt?: string;
  transactionNumber?: string | null;
  currency?: string;
  failureReason?: string | null;
  adminNote?: string | null;
};

function isAdmin(user: unknown) {
  return (
    !!user &&
    typeof user === 'object' &&
    (user as { role?: string }).role === 'admin'
  );
}

function canAct(status: string) {
  return (
    status === 'PENDING' ||
    status === 'PROCESSING' ||
    status === 'REVIEW_REQUIRED'
  );
}

export default function AdminDepositsPage() {
  const router = useRouter();
  const me = useEqubStore((s) => s.user);
  const [items, setItems] = useState<Deposit[]>([]);
  const [note, setNote] = useState('');
  const [verifyConfigured, setVerifyConfigured] = useState(false);
  const [banner, setBanner] = useState('');
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
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
      const res = await adminFetch('/api/admin/deposits');
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
        setVerifyConfigured(Boolean(json.data.verifyEtConfigured));
        setBanner(String(json.data.note || ''));
      }
    } catch {
      setMsg('Failed to load deposits');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const iv = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(iv);
  }, [load]);

  useEffect(() => {
    if (me && !isAdmin(me)) router.replace('/');
  }, [me, router]);

  async function act(depositId: string, action: 'approve' | 'reject') {
    setBusyId(depositId);
    setMsg('');
    try {
      const res = await adminFetch('/api/admin/deposits', {
        method: 'POST',
        body: JSON.stringify({
          action,
          depositId,
          note: note || undefined,
          reason: note || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg(
          action === 'approve'
            ? `Approved · balance ${json.balance ?? '—'}`
            : 'Rejected',
        );
        setNote('');
        await load();
      } else {
        setMsg(json.message || 'Action failed');
      }
    } catch {
      setMsg('Network error');
    }
    setBusyId(null);
  }

  if (!me || !isAdmin(me)) {
    return (
      <p className="py-16 text-center text-sm text-white/40">Admin only</p>
    );
  }

  const cards = [
    { label: 'Total', value: meta.total, icon: Landmark },
    { label: 'Need review', value: meta.pending, icon: Clock },
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Deposit review</h2>
          <p className="text-sm text-white/40">
            Telebirr top-ups · approve until Verify.ET is configured
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

      {!verifyConfigured && (
        <div className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="text-sm font-semibold text-amber-100">
              VERIFY_ET_API_KEY is not on the backend
            </p>
            <p className="mt-1 text-xs text-amber-100/70">
              {banner ||
                'Approve deposits below manually until the key is set in Vercel and you redeploy.'}
            </p>
          </div>
        </div>
      )}

      {verifyConfigured && (
        <p className="rounded-xl border border-equb-500/25 bg-equb-500/10 px-3 py-2 text-xs text-equb-200">
          Verify.ET is configured — auto-verify is active. You can still approve
          stuck review items below.
        </p>
      )}

      {msg && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
          {msg}
        </p>
      )}

      <label className="block text-xs text-white/45">
        Optional note (approve / reject)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Checked Telebirr SMS"
          className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/40"
        />
      </label>

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
            No deposits yet. When users paste a Telebirr txn without Verify.ET,
            they appear here for approval.
          </p>
        )}
        {items.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-3.5 last:border-0"
          >
            <div className="min-w-0">
              <p className="font-mono text-base font-bold text-gold-400">
                {Number(d.amount).toLocaleString()} {d.currency || 'ETB'}
              </p>
              <p className="text-[11px] text-white/40">
                {d.phone || d.userId?.slice(0, 12) || '—'}
                {d.transactionNumber
                  ? ` · txn ${d.transactionNumber}`
                  : ''}
              </p>
              <p className="text-[10px] text-white/25">
                {d.createdAt
                  ? new Date(d.createdAt).toLocaleString()
                  : d.id.slice(0, 12)}
              </p>
              {d.failureReason && (
                <p className="mt-0.5 text-[10px] text-amber-200/70">
                  {d.failureReason}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              {canAct(d.status) && (
                <>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => void act(d.id, 'approve')}
                    className="rounded-lg bg-equb-500 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                  >
                    {busyId === d.id ? '…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={() => void act(d.id, 'reject')}
                    className="rounded-lg border border-red-500/40 px-3 py-1.5 text-[11px] font-bold text-red-300 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
