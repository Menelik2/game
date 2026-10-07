'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEqubStore } from '@/lib/store';
import { adminFetch } from '@/lib/admin-fetch';
import {
  Smartphone,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Copy,
  Phone,
  User,
  ShieldCheck,
  AlertTriangle,
  Landmark,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';

type Deposit = {
  id: string;
  userId: string;
  amount: number;
  status: string;
  merchantOrderId?: string;
  transactionNumber?: string | null;
  failureReason?: string | null;
  createdAt?: string;
};

type TelebirrData = {
  merchant: {
    name: string;
    phone: string;
    minDeposit: number;
    maxDeposit: number;
    environment: string;
    enabled: boolean;
    instruction: string;
  };
  verifyEt: {
    configured: boolean;
    keyHint: string | null;
    baseUrl: string;
  };
  summary: {
    total: number;
    pending: number;
    confirmed: number;
    failed: number;
    todayVolume: number;
  };
  deposits: Deposit[];
  pending: Deposit[];
};

function isAdmin(user: unknown) {
  if (!user || typeof user !== 'object') return false;
  const u = user as { role?: string; phone?: string };
  if (u.role === 'admin') return true;
  const d = (u.phone || '').replace(/\D/g, '');
  return d === '900000000' || d === '251900000000' || d.endsWith('900000000');
}

export default function AdminTelebirrPage() {
  const me = useEqubStore((s) => s.user);
  const [data, setData] = useState<TelebirrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [txnDraft, setTxnDraft] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    window.setTimeout(() => setMsg(null), 4500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/telebirr');
      const json = await res.json();
      if (json?.success) setData(json.data);
      else flash('err', json?.message || 'Failed to load');
    } catch {
      flash('err', 'Network error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const iv = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(iv);
  }, [load]);

  if (!me || !isAdmin(me)) return null;

  async function action(depositId: string, kind: 'confirm' | 'reject') {
    setBusyId(depositId);
    try {
      const res = await adminFetch('/api/admin/telebirr', {
        method: 'POST',
        body: JSON.stringify({
          action: kind,
          depositId,
          transactionNumber: txnDraft[depositId] || undefined,
          reason: kind === 'reject' ? 'Rejected by admin' : undefined,
          note: kind === 'confirm' ? 'Manual admin confirm' : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        flash(
          'ok',
          kind === 'confirm'
            ? `Confirmed · balance ${json.balance ?? ''} ETB`
            : 'Rejected',
        );
        await load();
      } else flash('err', json.message || 'Failed');
    } catch {
      flash('err', 'Action failed');
    }
    setBusyId(null);
  }

  const m = data?.merchant;
  const s = data?.summary;
  const pending = data?.pending || [];
  const deposits = data?.deposits || [];

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Smartphone className="h-5 w-5 text-amber-400" /> Telebirr wallet
          </h2>
          <p className="text-sm text-white/40">
            Merchant · deposit review · Verify.ET · wallet history
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

      {msg && (
        <p
          className={clsx(
            'rounded-xl border px-3 py-2.5 text-sm',
            msg.type === 'ok'
              ? 'border-equb-500/30 bg-equb-500/10 text-equb-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200',
          )}
        >
          {msg.text}
        </p>
      )}

      <section className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-5">
        <p className="text-[11px] font-bold uppercase text-amber-300/80">
          Payment method · Telebirr
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="flex items-center gap-1.5 text-[10px] uppercase text-white/40">
              <Phone className="h-3 w-3" /> Send to
            </p>
            <p className="mt-1 font-mono text-2xl font-black">
              {m?.phone || '0977832379'}
            </p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(m?.phone || '0977832379');
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs"
            >
              <Copy className="h-3 w-3" /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="flex items-center gap-1.5 text-[10px] uppercase text-white/40">
              <User className="h-3 w-3" /> Name
            </p>
            <p className="mt-1 text-2xl font-black text-amber-200">
              {m?.name || 'Menelik'}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-white/40">
          <ShieldCheck className="h-3.5 w-3.5" /> Verify.ET
        </p>
        <span
          className={clsx(
            'rounded-full px-3 py-1 text-xs font-bold',
            data?.verifyEt.configured
              ? 'bg-equb-500/20 text-equb-300'
              : 'bg-orange-500/20 text-orange-300',
          )}
        >
          {data?.verifyEt.configured ? 'API key loaded' : 'Manual review mode'}
        </span>
        {!data?.verifyEt.configured && (
          <p className="mt-2 flex gap-2 text-xs text-orange-200/80">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Approve deposits below until VERIFY_ET_API_KEY is on the backend.
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Total', value: s?.total ?? '—', icon: Landmark },
          { label: 'Pending', value: s?.pending ?? '—', icon: Clock },
          { label: 'Confirmed', value: s?.confirmed ?? '—', icon: CheckCircle2 },
          { label: 'Failed', value: s?.failed ?? '—', icon: XCircle },
          {
            label: 'Today',
            value: s ? `${s.todayVolume.toLocaleString()} ETB` : '—',
            icon: Landmark,
          },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/10 p-3">
            <p className="text-[10px] uppercase text-white/40">{c.label}</p>
            <p className="mt-1 text-lg font-bold text-amber-200">{c.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-orange-200">
          Pending ({pending.length})
        </h3>
        {pending.length === 0 && (
          <p className="rounded-xl border border-white/5 py-8 text-center text-sm text-white/35">
            No pending deposits
          </p>
        )}
        {pending.map((d) => (
          <div
            key={d.id}
            className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4"
          >
            <p className="font-mono text-xl font-black text-gold-400">
              {Number(d.amount).toLocaleString()} ETB
            </p>
            <p className="text-[11px] text-white/40">
              {d.merchantOrderId} · {d.status}
              {d.userId ? ` · user ${d.userId.slice(0, 8)}` : ''}
            </p>
            {d.failureReason && (
              <p className="mt-1 text-[10px] text-amber-200/70">{d.failureReason}</p>
            )}
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                placeholder="Txn # (optional)"
                value={txnDraft[d.id] || d.transactionNumber || ''}
                onChange={(e) =>
                  setTxnDraft((p) => ({ ...p, [d.id]: e.target.value }))
                }
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={busyId === d.id}
                onClick={() => void action(d.id, 'confirm')}
                className="rounded-xl bg-equb-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                Approve + credit
              </button>
              <button
                type="button"
                disabled={busyId === d.id}
                onClick={() => void action(d.id, 'reject')}
                className="rounded-xl bg-red-500/20 px-4 py-2 text-xs font-bold text-red-200"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-bold text-white/50">
          Recent history ({deposits.length})
        </h3>
        {deposits.length === 0 && (
          <p className="py-6 text-center text-sm text-white/30">No history</p>
        )}
        {deposits.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-2 py-3"
          >
            <div>
              <span className="font-mono text-sm font-bold text-gold-400">
                {Number(d.amount).toLocaleString()} ETB
              </span>
              <p className="text-[10px] text-white/35">
                {d.transactionNumber || d.merchantOrderId || d.id.slice(0, 8)}
                {d.createdAt
                  ? ` · ${new Date(d.createdAt).toLocaleString()}`
                  : ''}
              </p>
            </div>
            <span className="text-[10px] uppercase text-white/40">{d.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
