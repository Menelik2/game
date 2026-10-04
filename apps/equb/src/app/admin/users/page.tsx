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
import { Search, AlertCircle } from 'lucide-react';

export default function AdminUsersPage() {
  const session = useEqubStore((s) => s.user);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [local, setLocal] = useState(localAdminSnapshot());
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creditAmt, setCreditAmt] = useState<Record<string, string>>({});

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => {
    load();
  }, [load]);

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
      <div className="rounded-2xl border border-white/10 p-8 text-center">
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
      <div className="flex flex-wrap gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load();
          }}
          className="flex min-w-[200px] flex-1 gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search phone or email"
              className="w-full rounded-xl border border-white/10 bg-surface-800 py-2.5 pl-10 pr-3 text-sm"
            />
          </div>
          <button type="submit" className="rounded-xl bg-amber-500/90 px-4 text-sm font-bold text-black">
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
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-white/40">Loading…</p>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{u.fullName || '—'}</p>
                  <p className="font-mono text-xs text-white/45">{u.phone || u.email}</p>
                  <p className="mt-1 text-[11px] text-white/30">
                    {new Date(u.createdAt).toLocaleString()}
                    {u.isAdmin ? ' · ADMIN' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black tabular-nums text-amber-200">
                    {Number(u.balance || 0).toLocaleString()}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      u.status === 'ACTIVE'
                        ? 'bg-equb-500/20 text-equb-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {u.status}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {u.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => onStatus(u.id, 'SUSPENDED')}
                    className="rounded-lg border border-red-500/30 px-2.5 py-1 text-[11px] text-red-300"
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => onStatus(u.id, 'ACTIVE')}
                    className="rounded-lg border border-equb-500/30 px-2.5 py-1 text-[11px] text-equb-300"
                  >
                    Activate
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => onAdmin(u.id, !u.isAdmin)}
                  className="rounded-lg border border-amber-500/30 px-2.5 py-1 text-[11px] text-amber-200"
                >
                  {u.isAdmin ? 'Revoke admin' : 'Make admin'}
                </button>
                <div className="ml-auto flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    placeholder="Credit"
                    value={creditAmt[u.id] || ''}
                    onChange={(e) =>
                      setCreditAmt((c) => ({ ...c, [u.id]: e.target.value }))
                    }
                    className="w-24 rounded-lg border border-white/10 bg-surface-800 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => onCredit(u.id)}
                    className="rounded-lg bg-amber-500/90 px-2.5 py-1 text-[11px] font-bold text-black"
                  >
                    + Credit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 p-4">
          <h2 className="mb-2 text-sm font-bold">Local accounts (device)</h2>
          {local.users.length === 0 ? (
            <p className="text-xs text-white/40">No users yet.</p>
          ) : (
            <ul className="divide-y divide-white/5 text-sm">
              {local.users.map((u) => (
                <li key={String(u.id)} className="flex justify-between py-2">
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
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
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
            className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
