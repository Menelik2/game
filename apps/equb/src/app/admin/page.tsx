'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { apiListUsers, apiSetBalance, type ApiUser } from '@/lib/auth-api';
import { formatBirrCompact } from '@/lib/money';
import { useI18n } from '@/lib/i18n/LanguageContext';
import clsx from 'clsx';

function sessionIsAdmin(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  return (user as { role?: string }).role === 'admin';
}

export default function AdminPage() {
  const router = useRouter();
  const { locale } = useI18n();
  const user = useEqubStore((s) => s.user);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const history = useEqubStore((s) => s.history);
  const rooms = useEqubStore((s) => s.rooms);
  const adminEarningsTotal = useEqubStore((s) => s.adminEarningsTotal);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [msg, setMsg] = useState('');
  const [editBal, setEditBal] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await apiListUsers();
    if (list) setUsers(list);
    else setUsers([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (user && !sessionIsAdmin(user)) router.replace('/');
  }, [user, router]);

  async function saveBalance(u: ApiUser) {
    const raw = editBal[u.id];
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      setMsg('Invalid balance');
      return;
    }
    const r = await apiSetBalance(u.id, n, 'admin_set');
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setMsg(`Updated ${u.fullName} → ${r.user.balance} Birr (database)`);
    if (user?.id === u.id) {
      setSessionUser({ ...user, balance: r.user.balance });
    }
    await refresh();
  }

  async function addBalance(u: ApiUser, amount: number) {
    const r = await apiSetBalance(u.id, u.balance + amount, 'admin_add');
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setMsg(`+${amount} Birr → ${u.fullName} (database)`);
    if (user?.id === u.id) {
      setSessionUser({ ...user, balance: r.user.balance });
    }
    await refresh();
  }

  if (!user) {
    return (
      <div className="glass mx-auto max-w-md space-y-4 rounded-2xl p-6 text-center">
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="text-sm text-white/50">
          Sign in as admin from Profile (database).
        </p>
        <p className="rounded-xl bg-black/30 p-3 font-mono text-xs text-equb-300">
          Phone: 0900000000
          <br />
          Password: Admin123!
        </p>
        <Link href="/profile" className="btn-gold inline-block px-6">
          Profile login
        </Link>
      </div>
    );
  }

  if (!sessionIsAdmin(user)) {
    return (
      <div className="py-12 text-center text-sm text-red-300">
        Access denied — admin only.
      </div>
    );
  }

  const openRooms = rooms.filter((r) => r.status === 'open').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Admin dashboard</h1>
        <p className="mt-1 text-xs text-white/40">
          Users & balances from Supabase database (not localStorage)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Users (DB)', value: users.length },
          { label: 'Open rooms', value: openRooms },
          {
            label: 'Admin fees',
            value: formatBirrCompact(adminEarningsTotal, locale),
          },
          { label: 'Draws', value: history.length },
        ].map((c) => (
          <div key={c.label} className="glass rounded-2xl p-4 text-center">
            <p className="text-[10px] uppercase text-white/40">{c.label}</p>
            <p className="mt-1 text-lg font-bold text-equb-300">{c.value}</p>
          </div>
        ))}
      </div>

      {msg && (
        <p className="rounded-xl bg-equb-500/15 px-4 py-2 text-xs text-equb-300">
          {msg}
        </p>
      )}

      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-bold">Database users</h2>
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-xs text-equb-400"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="p-6 text-center text-sm text-white/40">Loading…</p>
        ) : users.length === 0 ? (
          <p className="p-6 text-center text-sm text-white/40">
            No users yet — or database not configured
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {users.map((u) => (
              <li key={u.id} className="space-y-2 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {u.fullName}{' '}
                      {u.role === 'admin' && (
                        <span className="text-[10px] text-gold-400">ADMIN</span>
                      )}
                    </p>
                    <p className="font-mono text-[11px] text-white/40">{u.phone}</p>
                  </div>
                  <p
                    className={clsx(
                      'font-mono font-bold',
                      u.balance > 0 ? 'text-equb-400' : 'text-white/40',
                    )}
                  >
                    {formatBirrCompact(u.balance, locale)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="number"
                    min={0}
                    placeholder="Set balance"
                    value={editBal[u.id] ?? ''}
                    onChange={(e) =>
                      setEditBal((m) => ({ ...m, [u.id]: e.target.value }))
                    }
                    className="w-28 rounded-lg border border-white/10 bg-surface-800 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void saveBalance(u)}
                    className="rounded-lg bg-equb-500/25 px-3 py-1 text-xs font-bold text-equb-300"
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    onClick={() => void addBalance(u, 100)}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs"
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    onClick={() => void addBalance(u, 500)}
                    className="rounded-lg bg-white/10 px-3 py-1 text-xs"
                  >
                    +500
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link href="/" className="block text-center text-sm text-white/50">
        ← Home
      </Link>
    </div>
  );
}
