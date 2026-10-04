'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  adminAddBalance,
  adminListAccounts,
  adminSetBalance,
  adminSetBanned,
  ensureAdminAccount,
  type LocalAccount,
} from '@/lib/auth-local';
import { formatBirrCompact } from '@/lib/money';
import { useI18n } from '@/lib/i18n/LanguageContext';
import clsx from 'clsx';

const QUICK_ADD = [100, 500, 1000, 5000];

/** Safe admin check — does not depend on store User typing */
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
  const [users, setUsers] = useState<LocalAccount[]>([]);
  const [msg, setMsg] = useState('');
  const [editBal, setEditBal] = useState<Record<string, string>>({});
  const [addBal, setAddBal] = useState<Record<string, string>>({});

  function refresh() {
    setUsers(adminListAccounts());
  }

  function syncSessionBalance(userId: string, balance: number) {
    if (user && user.id === userId) {
      setSessionUser({ ...user, balance });
    }
  }

  useEffect(() => {
    void ensureAdminAccount().then(refresh);
  }, []);

  useEffect(() => {
    if (user && !sessionIsAdmin(user)) router.replace('/');
  }, [user, router]);

  if (!user) {
    return (
      <div className="glass mx-auto max-w-md space-y-4 rounded-2xl p-6 text-center">
        <h1 className="text-xl font-bold">Admin</h1>
        <p className="text-sm text-white/50">Sign in as admin from Profile only.</p>
        <p className="rounded-xl bg-black/30 p-3 font-mono text-xs text-equb-300">
          {ADMIN_EMAIL}
          <br />
          {ADMIN_PASSWORD}
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
        Access denied — admin only. Players cannot open this page.
      </div>
    );
  }

  const openRooms = rooms.filter((r) => r.status === 'open').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Admin dashboard</h1>
        <p className="mt-1 text-xs text-white/40">
          Set balance or add Birr to any registered user
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Users', value: users.length },
          { label: 'Open rooms', value: openRooms },
          { label: 'Draws', value: history.length },
          {
            label: 'Admin fees',
            value: formatBirrCompact(adminEarningsTotal || 0, locale),
          },
        ].map((c) => (
          <div key={c.label} className="glass rounded-2xl p-4 text-center">
            <p className="text-[10px] uppercase text-white/40">{c.label}</p>
            <p className="mt-1 text-lg font-bold text-equb-300">{c.value}</p>
          </div>
        ))}
      </div>

      {msg && (
        <p className="rounded-xl border border-equb-500/30 bg-equb-500/10 px-3 py-2 text-xs text-equb-200">
          {msg}
        </p>
      )}

      <section className="glass overflow-hidden rounded-2xl">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-bold">Users & balances</h2>
        </div>
        <div className="divide-y divide-white/5">
          {users.length === 0 && (
            <p className="p-4 text-sm text-white/40">
              No registered users yet. Players must Register on Profile first
              (guest demo users are not listed).
            </p>
          )}
          {users.map((a) => (
            <div key={a.id} className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {a.fullName}{' '}
                    <span
                      className={clsx(
                        'ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                        a.role === 'admin'
                          ? 'bg-gold-500/20 text-gold-400'
                          : 'bg-white/10 text-white/50',
                      )}
                    >
                      {a.role || 'player'}
                    </span>
                    {a.banned && (
                      <span className="ml-1 text-[10px] text-red-400">BANNED</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-white/40">{a.email || a.phone}</p>
                  <p className="mt-1 font-mono text-base font-bold text-equb-400">
                    {formatBirrCompact(a.balance, locale)}
                  </p>
                </div>
                {a.role !== 'admin' && (
                  <button
                    type="button"
                    className={clsx(
                      'rounded-lg px-2.5 py-1.5 text-[11px] font-bold',
                      a.banned
                        ? 'bg-equb-500/20 text-equb-300'
                        : 'bg-red-500/20 text-red-300',
                    )}
                    onClick={() => {
                      adminSetBanned(a.id, !a.banned);
                      refresh();
                      setMsg(a.banned ? 'Unbanned' : 'Banned');
                    }}
                  >
                    {a.banned ? 'Unban' : 'Ban'}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="w-full text-[10px] uppercase text-white/35 sm:w-auto">
                  Set balance
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="w-28 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                  value={editBal[a.id] ?? ''}
                  placeholder={String(a.balance)}
                  onChange={(e) =>
                    setEditBal((m) => ({ ...m, [a.id]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/80"
                  onClick={() => {
                    const v = Number(editBal[a.id]);
                    if (!Number.isFinite(v) || v < 0) {
                      setMsg('Enter a valid balance ≥ 0');
                      return;
                    }
                    const r = adminSetBalance(a.id, v);
                    setMsg(r.message);
                    if (r.ok && r.balance != null) {
                      syncSessionBalance(a.id, r.balance);
                      setEditBal((m) => ({ ...m, [a.id]: '' }));
                      refresh();
                    }
                  }}
                >
                  Set
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="w-full text-[10px] uppercase text-white/35 sm:w-auto">
                  Add Birr
                </span>
                {QUICK_ADD.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="rounded-lg bg-equb-500/20 px-2.5 py-1.5 text-[11px] font-bold text-equb-300"
                    onClick={() => {
                      const r = adminAddBalance(a.id, q);
                      setMsg(r.message);
                      if (r.ok && r.balance != null) {
                        syncSessionBalance(a.id, r.balance);
                        refresh();
                      }
                    }}
                  >
                    +{q}
                  </button>
                ))}
                <input
                  type="number"
                  step={1}
                  className="w-24 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                  value={addBal[a.id] ?? ''}
                  placeholder="+ / −"
                  onChange={(e) =>
                    setAddBal((m) => ({ ...m, [a.id]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="rounded-lg bg-gold-500/25 px-2.5 py-1.5 text-[11px] font-bold text-gold-300"
                  onClick={() => {
                    const v = Number(addBal[a.id]);
                    if (!Number.isFinite(v) || v === 0) {
                      setMsg('Enter amount to add (e.g. 500 or -100)');
                      return;
                    }
                    const r = adminAddBalance(a.id, v);
                    setMsg(r.message);
                    if (r.ok && r.balance != null) {
                      syncSessionBalance(a.id, r.balance);
                      setAddBal((m) => ({ ...m, [a.id]: '' }));
                      refresh();
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-[10px] text-white/30">
        Only users who registered (email/phone) appear here. Guest demo accounts
        are not stored.
      </p>
    </div>
  );
}
