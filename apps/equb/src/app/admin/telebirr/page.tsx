'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEqubStore } from '@/lib/store';
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
  confirmedAt?: string | null;
  adminNote?: string | null;
};

type TelebirrData = {
  merchant: {
    name: string;
    phone: string;
    currency: string;
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
    environment: string;
  };
  telebirrApi: {
    checkoutAvailable: boolean;
    hasSigningSecrets: boolean;
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
  return (
    !!user &&
    typeof user === 'object' &&
    (user as { role?: string }).role === 'admin'
  );
}

export default function AdminTelebirrPage() {
  const router = useRouter();
  const me = useEqubStore((s) => s.user);
  const [data, setData] = useState<TelebirrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );
  const [txnDraft, setTxnDraft] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    window.setTimeout(() => setMsg(null), 4500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/telebirr', { cache: 'no-store' });
      const json = await res.json();
      if (json?.success) setData(json.data);
      else flash('err', json?.message || 'Failed to load Telebirr');
    } catch {
      flash('err', 'Network error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (me && !isAdmin(me)) router.replace('/');
  }, [me, router]);

  async function action(
    depositId: string,
    kind: 'confirm' | 'reject',
  ) {
    setBusyId(depositId);
    try {
      const res = await fetch('/api/admin/telebirr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            ? `Deposit confirmed · balance ${json.balance?.toLocaleString?.() ?? json.balance} ETB`
            : 'Deposit rejected',
        );
        await load();
      } else flash('err', json.message || 'Action failed');
    } catch {
      flash('err', 'Action failed');
    }
    setBusyId(null);
  }

  function copyPhone() {
    const phone = data?.merchant.phone;
    if (!phone) return;
    void navigator.clipboard.writeText(phone);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (!me || !isAdmin(me)) {
    return (
      <p className="py-16 text-center text-sm text-white/40">Admin only</p>
    );
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
            <Smartphone className="h-5 w-5 text-amber-400" />
            Telebirr wallet
          </h2>
          <p className="text-sm text-white/40">
            Merchant receiving account · deposit review · Verify.ET
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
            'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm',
            msg.type === 'ok'
              ? 'border-equb-500/30 bg-equb-500/10 text-equb-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200',
          )}
        >
          {msg.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {msg.text}
        </p>
      )}

      {/* Merchant card */}
      <section className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-amber-500/10 to-transparent p-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300/80">
          Payment method · Telebirr
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="flex items-center gap-1.5 text-[10px] uppercase text-white/40">
              <Phone className="h-3 w-3" /> Send payment to
            </p>
            <p className="mt-1 font-mono text-2xl font-black tracking-wide text-white">
              {m?.phone || '0977832379'}
            </p>
            <button
              type="button"
              onClick={copyPhone}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70"
            >
              <Copy className="h-3 w-3" />
              {copied ? 'Copied!' : 'Copy number'}
            </button>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="flex items-center gap-1.5 text-[10px] uppercase text-white/40">
              <User className="h-3 w-3" /> Account name
            </p>
            <p className="mt-1 text-2xl font-black text-amber-200">
              {m?.name || 'Menelik'}
            </p>
            <p className="mt-2 text-xs text-white/45">
              {m?.instruction ||
                'Complete Telebirr payment, then verify transaction.'}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/60">
            Min {m?.minDeposit ?? 10} · Max {m?.maxDeposit ?? 50000} ETB
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/60">
            Env: {m?.environment || 'sandbox'}
          </span>
          <span
            className={clsx(
              'rounded-full px-2.5 py-1 font-semibold',
              m?.enabled
                ? 'bg-equb-500/20 text-equb-300'
                : 'bg-red-500/20 text-red-300',
            )}
          >
            {m?.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <p className="mt-3 text-[11px] text-white/30">
          Change merchant phone/name via Vercel env:{' '}
          <code className="text-white/50">TELEBIRR_MERCHANT_PHONE</code>,{' '}
          <code className="text-white/50">TELEBIRR_MERCHANT_NAME</code>
        </p>
      </section>

      {/* Verify.ET status */}
      <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
          <ShieldCheck className="h-3.5 w-3.5" /> Verify.ET status
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={clsx(
              'rounded-full px-3 py-1 text-xs font-bold',
              data?.verifyEt.configured
                ? 'bg-equb-500/20 text-equb-300'
                : 'bg-orange-500/20 text-orange-300',
            )}
          >
            {data?.verifyEt.configured
              ? 'API key loaded'
              : 'Not configured — manual review'}
          </span>
          {data?.verifyEt.keyHint && (
            <span className="font-mono text-[11px] text-white/35">
              {data.verifyEt.keyHint}
            </span>
          )}
          <span className="text-[11px] text-white/35">
            {data?.verifyEt.baseUrl}
          </span>
        </div>
        {!data?.verifyEt.configured && (
          <p className="mt-2 flex items-start gap-2 text-xs text-orange-200/80">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Set VERIFY_ET_API_KEY in Vercel and redeploy. Until then, approve
            deposits manually below.
          </p>
        )}
      </section>

      {/* Summary cards */}
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

      {/* Pending review */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-orange-200">
          Pending review ({pending.length})
        </h3>
        {pending.length === 0 && (
          <p className="rounded-xl border border-white/5 bg-black/20 px-4 py-8 text-center text-sm text-white/35">
            No pending Telebirr deposits.
          </p>
        )}
        {pending.map((d) => (
          <div
            key={d.id}
            className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xl font-black text-gold-400">
                  {Number(d.amount).toLocaleString()} ETB
                </p>
                <p className="text-[11px] text-white/40">
                  User {d.userId.slice(0, 8)}… · {d.merchantOrderId}
                </p>
                <p className="text-[10px] text-white/25">
                  {d.createdAt
                    ? new Date(d.createdAt).toLocaleString()
                    : d.id.slice(0, 12)}
                </p>
                {d.failureReason && (
                  <p className="mt-1 text-xs text-orange-300/80">
                    {d.failureReason}
                  </p>
                )}
              </div>
              <span className="rounded-full bg-orange-500/20 px-2.5 py-1 text-[10px] font-bold uppercase text-orange-300">
                {d.status}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                placeholder="Txn # (optional)"
                value={txnDraft[d.id] || d.transactionNumber || ''}
                onChange={(e) =>
                  setTxnDraft((prev) => ({ ...prev, [d.id]: e.target.value }))
                }
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-amber-500/40"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => void action(d.id, 'confirm')}
                  className="rounded-xl bg-equb-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {busyId === d.id ? '…' : 'Approve + credit'}
                </button>
                <button
                  type="button"
                  disabled={busyId === d.id}
                  onClick={() => void action(d.id, 'reject')}
                  className="rounded-xl bg-red-500/20 px-4 py-2 text-xs font-bold text-red-200 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* All deposits */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold text-white/50">
          Recent deposits ({deposits.length})
        </h3>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          {deposits.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-white/30">
              No deposits yet.
            </p>
          )}
          {deposits.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="font-mono text-sm font-bold text-gold-400">
                  {Number(d.amount).toLocaleString()} ETB
                </p>
                <p className="truncate text-[11px] text-white/35">
                  {d.merchantOrderId}
                  {d.transactionNumber ? ` · ${d.transactionNumber}` : ''}
                </p>
              </div>
              <span
                className={clsx(
                  'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
                  d.status === 'CONFIRMED' && 'bg-equb-500/20 text-equb-300',
                  (d.status === 'PENDING' ||
                    d.status === 'PROCESSING' ||
                    d.status === 'REVIEW_REQUIRED') &&
                    'bg-orange-500/20 text-orange-300',
                  d.status === 'FAILED' && 'bg-red-500/20 text-red-300',
                )}
              >
                {d.status}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
