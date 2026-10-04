'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import {
  fetchAdminDashboard,
  localAdminSnapshot,
  type AdminDashboard,
} from '@/lib/admin-api';
import { isApiConfigured } from '@/lib/api';
import {
  Users,
  Activity,
  Wallet,
  UserPlus,
  AlertCircle,
  ShieldAlert,
  UserCog,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const user = useEqubStore((s) => s.user);
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [local, setLocal] = useState(localAdminSnapshot());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLocal(localAdminSnapshot());
    let cancelled = false;
    (async () => {
      if (!isApiConfigured()) {
        setLoading(false);
        return;
      }
      try {
        const d = await fetchAdminDashboard();
        if (!cancelled) setData(d);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-400" />
        <p className="mt-3 text-sm text-white/60">Sign in to open Admin</p>
        <Link href="/profile" className="mt-4 inline-block text-sm text-equb-400 underline">
          Go to profile
        </Link>
      </div>
    );
  }

  const maxSignups = Math.max(1, ...(data?.signupsByDay?.map((d) => d.count) || [1]));

  const cards = data
    ? [
        {
          label: 'Users',
          value: data.registeredUsers,
          icon: Users,
          sub: `${data.activeUsers} active · ${data.suspendedUsers ?? 0} suspended`,
        },
        {
          label: 'New (7d)',
          value: data.newUsersLast7d ?? 0,
          icon: UserPlus,
          sub: 'Signups last 7 days',
        },
        {
          label: 'Tx (24h)',
          value: data.transactionsLast24h,
          icon: Activity,
          sub: `${data.totalTransactions} all time`,
        },
        {
          label: 'Demo pool',
          value: data.totalDemoBalance.toLocaleString(),
          icon: Wallet,
          sub: data.demoMode ? 'Demo mode' : 'Live flags',
        },
        {
          label: 'Admins',
          value: data.adminUsers ?? 0,
          icon: UserCog,
          sub: `${data.activeGames} games active`,
        },
        {
          label: 'Risk',
          value: data.suspendedUsers ?? 0,
          icon: ShieldAlert,
          sub: data.realMoneyEnabled ? 'Real money ON' : 'Virtual only',
        },
      ]
    : [
        {
          label: 'Local accounts',
          value: local.total,
          icon: Users,
          sub: 'This browser only',
        },
      ];

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          API: {error}. Need admin JWT (isAdmin). Local data may still show.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-white/40">Loading overview…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {cards.map(({ label, value, icon: Icon, sub }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-4"
              >
                <div className="flex items-center gap-2 text-white/40">
                  <Icon className="h-4 w-4" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
                </div>
                <p className="mt-2 text-2xl font-black tabular-nums text-amber-200">{value}</p>
                <p className="text-[11px] text-white/35">{sub}</p>
              </div>
            ))}
          </div>

          {data?.signupsByDay && data.signupsByDay.length > 0 && (
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="mb-4 text-sm font-bold text-white/80">Signups · 7 days</h2>
              <div className="flex h-28 items-end gap-2">
                {data.signupsByDay.map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] tabular-nums text-white/40">{d.count}</span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-amber-600/80 to-amber-400/50"
                      style={{
                        height: `${Math.max(4, (d.count / maxSignups) * 100)}%`,
                        minHeight: 4,
                      }}
                    />
                    <span className="text-[9px] text-white/30">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {data?.recentUsers && data.recentUsers.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white/80">Recent users</h2>
                  <Link href="/admin/users" className="text-xs text-equb-400">
                    Manage
                  </Link>
                </div>
                <ul className="divide-y divide-white/5 text-sm">
                  {data.recentUsers.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.fullName || u.phone || u.email}
                        </p>
                        <p className="truncate font-mono text-[11px] text-white/35">
                          {u.phone || u.email}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          u.status === 'ACTIVE'
                            ? 'bg-equb-500/20 text-equb-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {u.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data?.recentAudit && data.recentAudit.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white/80">Audit stream</h2>
                  <Link href="/admin/audit" className="text-xs text-equb-400">
                    Full log
                  </Link>
                </div>
                <ul className="space-y-2 text-xs">
                  {data.recentAudit.slice(0, 10).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-2"
                    >
                      <span className="font-medium text-amber-100/90">{a.action}</span>
                      <span className="text-white/30">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data?.recentTransactions && data.recentTransactions.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
                <h2 className="mb-3 text-sm font-bold text-white/80">Recent transactions</h2>
                <ul className="grid gap-2 sm:grid-cols-2 text-xs">
                  {data.recentTransactions.slice(0, 12).map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-2"
                    >
                      <span className="text-white/60">
                        {t.type} · {t.status}
                      </span>
                      <span className="font-mono text-amber-200/90">
                        {t.amount} {t.currency}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!data && local.users.length > 0 && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-2">
                <h2 className="mb-3 text-sm font-bold text-white/80">Local accounts (device)</h2>
                <ul className="divide-y divide-white/5 text-sm">
                  {local.users.map((u) => (
                    <li key={String(u.id)} className="flex justify-between py-2.5">
                      <div>
                        <p className="font-medium">{String(u.fullName)}</p>
                        <p className="font-mono text-[11px] text-white/35">{String(u.phone)}</p>
                      </div>
                      <span className="text-amber-300/90">{String(u.balance)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
