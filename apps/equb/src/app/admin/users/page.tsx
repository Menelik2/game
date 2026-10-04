'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import {
  fetchAdminUsers,
  setAdminUserStatus,
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
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLocal(localAdminSnapshot());
    if (!isApiConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminUsers(page, q);
      setItems(res.items || []);
      setTotalPages(res.meta?.totalPages || 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => {
    load();
  }, [load]);

  const onStatus = async (id: string, status: 'ACTIVE' | 'SUSPENDED') => {
    setBusyId(id);
    try {
      await setAdminUserStatus(id, status);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load();
        }}
        className="flex gap-2"
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

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-white/40">Loading…</p>
      ) : items.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-3 py-2.5">User</th>
                <th className="px-3 py-2.5">Phone</th>
                <th className="px-3 py-2.5">Balance</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.03]">
                  <td className="px-3 py-3">
                    <p className="font-medium">{u.fullName || '—'}</p>
                    <p className="text-[11px] text-white/35">{u.email}</p>
                    {u.isAdmin && (
                      <span className="text-[10px] text-amber-400">admin</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs">{u.phone || '—'}</td>
                  <td className="px-3 py-3 text-amber-200/90">
                    {Number(u.balance || 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        u.status === 'ACTIVE'
                          ? 'bg-equb-500/20 text-equb-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {u.status}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => onStatus(u.id, 'SUSPENDED')}
                          className="rounded-lg border border-red-500/30 px-2 py-1 text-[11px] text-red-300"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === u.id}
                          onClick={() => onStatus(u.id, 'ACTIVE')}
                          className="rounded-lg border border-equb-500/30 px-2 py-1 text-[11px] text-equb-300"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
