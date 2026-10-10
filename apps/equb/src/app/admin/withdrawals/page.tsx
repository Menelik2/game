'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatBirrCompact } from '@/lib/money';
import {
  ArrowUpFromLine,
  Check,
  X,
  RefreshCw,
  Phone,
  Loader2,
  Copy,
} from 'lucide-react';
import clsx from 'clsx';

type W = {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  amount: number;
  payoutPhone: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  paidAt: string | null;
};

export default function AdminWithdrawalsPage() {
  const [items, setItems] = useState<W[]>([]);
  const [pendingAmt, setPendingAmt] = useState(0);
  const [pendingN, setPendingN] = useState(0);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'REJECTED'>(
    'PENDING',
  );

  const load = useCallback(async () => {
    try {
      const q =
        filter === 'ALL' ? '' : `?status=${encodeURIComponent(filter)}`;
      const res = await adminFetch(`/api/admin/withdrawals${q}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data.withdrawals || []);
        setPendingAmt(json.data.summary?.totalPendingAmount || 0);
        setPendingN(json.data.summary?.pending || 0);
        setMsg(null);
      } else {
        setMsg({ type: 'err', text: json.message || 'Load failed' });
      }
    } catch (e) {
      setMsg({
        type: 'err',
        text: e instanceof Error ? e.message : 'Load failed',
      });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 10000);
    return () => clearInterval(iv);
  }, [load]);

  async function act(action: 'pay' | 'reject', id: string) {
    if (action === 'pay') {
      if (
        !confirm(
          'Confirm you already sent this amount via Telebirr to the player number?',
        )
      ) {
        return;
      }
    }
    setBusy(`${action}:${id}`);
    try {
      const res = await adminFetch('/api/admin/withdrawals', {
        method: 'POST',
        body: JSON.stringify({ action, withdrawalId: id }),
      });
      const json = await res.json();
      if (!json.success) {
        setMsg({ type: 'err', text: json.message || 'Failed' });
      } else {
        setMsg({ type: 'ok', text: json.message || 'Done' });
        await load();
      }
    } catch (e) {
      setMsg({
        type: 'err',
        text: e instanceof Error ? e.message : 'Failed',
      });
    } finally {
      setBusy(null);
    }
  }

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone);
      setMsg({ type: 'ok', text: `Copied ${phone}` });
    } catch {
      setMsg({ type: 'err', text: 'Copy failed' });
    }
  }

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-amber-50">
            <ArrowUpFromLine className="h-5 w-5 text-amber-400" />
            Withdrawals
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Send ETB from your Telebirr to the player number, then mark Paid
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-white/70"
        >
          <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-3">
          <p className="text-[10px] uppercase text-amber-200/60">Pending</p>
          <p className="font-mono text-xl font-black text-amber-200">{pendingN}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
          <p className="text-[10px] uppercase text-white/40">To pay</p>
          <p className="font-mono text-xl font-black text-gold-300">
            {formatBirrCompact(pendingAmt, 'am')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['PENDING', 'PAID', 'REJECTED', 'ALL'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={clsx(
              'rounded-full px-3 py-1.5 text-[11px] font-bold',
              filter === f
                ? 'bg-amber-400 text-black'
                : 'border border-white/10 text-white/50',
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {msg && (
        <p
          className={clsx(
            'rounded-xl border px-3 py-2 text-xs',
            msg.type === 'ok'
              ? 'border-equb-500/30 bg-equb-500/10 text-equb-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200',
          )}
        >
          {msg.text}
        </p>
      )}

      {loading && items.length === 0 && (
        <div className="flex justify-center gap-2 py-12 text-sm text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      )}

      <ul className="space-y-2">
        {!loading && items.length === 0 && (
          <p className="rounded-2xl border border-white/10 py-10 text-center text-sm text-white/35">
            No withdrawals
          </p>
        )}
        {items.map((w) => (
          <li
            key={w.id}
            className="rounded-2xl border border-white/10 bg-black/40 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-lg font-black text-gold-300">
                  {formatBirrCompact(w.amount, 'am')}
                </p>
                <p className="text-sm font-semibold text-white">{w.userName}</p>
                <p className="text-[11px] text-white/40">
                  Account {w.userPhone} · {new Date(w.createdAt).toLocaleString()}
                </p>
                <button
                  type="button"
                  onClick={() => void copyPhone(w.payoutPhone)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-equb-500/30 bg-equb-500/10 px-2.5 py-1.5 font-mono text-xs font-bold text-equb-200"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {w.payoutPhone}
                  <Copy className="h-3 w-3 opacity-60" />
                </button>
                <p className="mt-1 text-[10px] text-white/35">
                  Send Telebirr to this number, then mark Paid
                </p>
              </div>
              <span
                className={clsx(
                  'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
                  w.status === 'PENDING' && 'bg-amber-500/20 text-amber-200',
                  w.status === 'PAID' && 'bg-equb-500/20 text-equb-200',
                  w.status === 'REJECTED' && 'bg-red-500/20 text-red-200',
                )}
              >
                {w.status}
              </span>
            </div>
            {w.status === 'PENDING' && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void act('pay', w.id)}
                  className="flex items-center gap-1.5 rounded-xl bg-equb-500 px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                  {busy === `pay:${w.id}` ? '…' : 'Mark paid'}
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void act('reject', w.id)}
                  className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                  {busy === `reject:${w.id}` ? '…' : 'Reject + refund'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
