'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import {
  fetchAdminUsers,
  setAdminUserStatus,
  setAdminFlag,
  creditUser,
  localAdminSnapshot,
  type AdminUser,
} from '@/lib/admin-api';
import { isApiConfigured } from '@/lib/api';
import {
  Search,
  AlertCircle,
  Download,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';

function exportCsv(rows: AdminUser[]) {
  const header = ['id', 'fullName', 'phone', 'email', 'status', 'isAdmin', 'balance', 'createdAt'];
  const lines = [
    header.join(','),
    ...rows.map((u) =>
      [
        u.id,
        JSON.stringify(u.fullName || ''),
        JSON.stringify(u.phone || ''),
        JSON.stringify(u.email || ''),
        u.status,
        u.isAdmin,
        u.balance,
        u.createdAt,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `equb-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminUsersPage() {
  const session = useEqubStore((s) => s.user);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [local, setLocal] = useState(localAdminSnapshot());
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creditAmt, setCreditAmt] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLocal(localAdminSnapshot());
    if (!isApiConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminUsers(page, q, status);
      setItems(res.items || []);
      setTotalPages(res.meta?.totalPages || 1);
      setTotal(res.meta?.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => {
    load();
  }, [load]);

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const onStatus = async (id: string, st: 'ACTIVE' | 'SUSPENDED') => {
    setBusyId(id);
    try {
      await setAdminUserStatus(id, st);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const onAdmin = async (id: string, isAdmin: boolean) => {
    setBusyId(id);
    try {
      await setAdminFlag(id, isAdmin);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const onCredit = async (id: string) => {
    const amount = parseFloat(creditAmt[id] || '0');
    if (!amount || amount <= 0) return;
    setBusyId(id);
    try {
      await creditUser(id, amount, 'Admin console credit');
      setCreditAmt((c) => ({ ...c, [id]: '' }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Credit failed');
    } finally {
      setBusyId(null);
    }
  };

  if (!session) {
    return (
      <div className="rounded-3xl border border-white/10 p-10 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-400" />
        <p className="mt-3 text-sm text-white/60">Sign in required</p>
        <Link href="/profile" className="mt-3 inline-block text-equb-400 underline">
          Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/45">
          {total > 0 ? `${total} users` : 'User directory'}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 hover:bg-white/5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => exportCsv(items)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load();
          }}
          className="flex min-w-[220px] flex-1 gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search phone or email…"
              className="w-full rounded-xl border border-white/10 bg-surface-800/90 py-2.5 pl-10 pr-3 text-sm outline-none ring-amber-500/30 focus:ring-2"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-amber-500 px-4 text-sm font-bold text-black shadow shadow-amber-500/20"
          >
            Search
          </button>
        </form>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm"
        >
          <option value="">All status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((u) => (
            <div
              key={u.id}
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-4 shadow-lg shadow-black/10"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-equb-400 to-equb-700 text-lg font-black text-black">
                    {(u.fullName || u.phone || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white">{u.fullName || '—'}</p>
                    <button
                      type="button"
                      onClick={() => copyText(u.phone || u.email, u.id)}
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-white/50 hover:text-amber-200"
                    >
                      {u.phone || u.email}
                      {copied === u.id ? (
                        <Check className="h-3 w-3 text-equb-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <p className="mt-1 text-[11px] text-white/30">
                      {new Date(u.createdAt).toLocaleString()}
                      {u.isAdmin ? (
                        <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                          ADMIN
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black tabular-nums text-amber-200">
                    {Number(u.balance || 0).toLocaleString()}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      u.status === 'ACTIVE'
                        ? 'bg-equb-500/20 text-equb-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {u.status}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                {u.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => onStatus(u.id, 'SUSPENDED')}
                    className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-300 disabled:opacity-50"
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => onStatus(u.id, 'ACTIVE')}
                    className="rounded-xl border border-equb-500/35 bg-equb-500/10 px-3 py-1.5 text-[11px] font-semibold text-equb-300 disabled:opacity-50"
                  >
                    Activate
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => onAdmin(u.id, !u.isAdmin)}
                  className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 disabled:opacity-50"
                >
                  {u.isAdmin ? 'Revoke admin' : 'Make admin'}
                </button>
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    placeholder="Amount"
                    value={creditAmt[u.id] || ''}
                    onChange={(e) =>
                      setCreditAmt((c) => ({ ...c, [u.id]: e.target.value }))
                    }
                    className="w-24 rounded-xl border border-white/10 bg-surface-800 px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-500/40"
                  />
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => onCredit(u.id)}
                    className="rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-black shadow shadow-amber-500/20 disabled:opacity-50"
                  >
                    + Credit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-2 text-sm font-bold">Local accounts (device)</h2>
          {local.users.length === 0 ? (
            <p className="text-xs text-white/40">No users yet.</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {local.users.map((u) => (
                <li key={String(u.id)} className="flex justify-between py-2.5">
                  <span>
                    {String(u.fullName)}{' '}
                    <span className="font-mono text-xs text-white/40">{String(u.phone)}</span>
                  </span>
                  <span className="text-amber-300">{String(u.balance)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl border border-white/10 px-4 py-1.5 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-white/40">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border border-white/10 px-4 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
