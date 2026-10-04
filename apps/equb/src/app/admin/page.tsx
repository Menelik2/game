'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import {
  fetchAdminDashboard,
  localAdminSnapshot,
  type AdminDashboard,
} from '@/lib/admin-api';
import { isApiConfigured } from '@/lib/api';
import { ADMIN_FEE_RATE } from '@/lib/equb-math';
import {
  Users,
  Activity,
  Wallet,
  UserPlus,
  AlertCircle,
  ShieldAlert,
  UserCog,
  RefreshCw,
  ArrowRight,
  Percent,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const user = useEqubStore((s) => s.user);
  const adminEarningsTotal = useEqubStore((s) => s.adminEarningsTotal);
  const adminFeeLog = useEqubStore((s) => s.adminFeeLog);
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [local, setLocal] = useState(localAdminSnapshot());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (soft = false) => {
    setLocal(localAdminSnapshot());
    if (!isApiConfigured()) {
      setLoading(false);
      return;
    }
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const d = await fetchAdminDashboard();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!user) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-amber-400" />
        <p className="mt-4 text-base font-semibold text-white/80">Sign in to open Admin</p>
        <Link
          href="/profile"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-black"
        >
          Go to profile <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const maxSignups = Math.max(1, ...(data?.signupsByDay?.map((d) => d.count) || [1]));
  const feePct = Math.round(ADMIN_FEE_RATE * 100);

  const cards = data
    ? [
        {
          label: 'Users',
          value: data.registeredUsers,
          icon: Users,
          sub: `${data.activeUsers} active · ${data.suspendedUsers ?? 0} suspended`,
          tone: 'from-emerald-500/20 to-transparent',
        },
        {
          label: 'New (7d)',
          value: data.newUsersLast7d ?? 0,
          icon: UserPlus,
          sub: 'Signups last 7 days',
          tone: 'from-sky-500/20 to-transparent',
        },
        {
          label: 'Tx (24h)',
          value: data.transactionsLast24h,
          icon: Activity,
          sub: `${data.totalTransactions} all time`,
          tone: 'from-violet-500/20 to-transparent',
        },
        {
          label: 'Demo pool',
          value: data.totalDemoBalance.toLocaleString(),
          icon: Wallet,
          sub: data.demoMode ? 'Demo mode' : 'Live flags',
          tone: 'from-amber-500/25 to-transparent',
        },
        {
          label: 'Admins',
          value: data.adminUsers ?? 0,
          icon: UserCog,
          sub: `${data.activeGames} games active`,
          tone: 'from-orange-500/20 to-transparent',
        },
        {
          label: 'Suspended',
          value: data.suspendedUsers ?? 0,
          icon: ShieldAlert,
          sub: data.realMoneyEnabled ? 'Real money ON' : 'Virtual only',
          tone: 'from-red-500/20 to-transparent',
        },
      ]
    : [
        {
          label: 'Local accounts',
          value: local.total,
          icon: Users,
          sub: 'This browser only',
          tone: 'from-amber-500/20 to-transparent',
        },
      ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/45">Live operations snapshot</p>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* 15% game fee */}
      <section className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-950/30 to-transparent p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-black">
              <Percent className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-amber-200/80">
                Admin game fee · {feePct}%
              </p>
              <p className="mt-1 text-3xl font-black tabular-nums text-amber-100">
                {Number(adminEarningsTotal || 0).toLocaleString()}{' '}
                <span className="text-base font-semibold text-amber-200/60">Birr</span>
              </p>
              <p className="mt-1 text-[11px] text-white/40">
                Every completed game: winner 85% · platform {feePct}% of pot
              </p>
            </div>
          </div>
          <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-semibold text-amber-200/90">
            {(adminFeeLog || []).length} games logged
          </span>
        </div>
        {(adminFeeLog || []).length > 0 && (
          <ul className="mt-4 max-h-40 space-y-1.5 overflow-y-auto text-xs">
            {(adminFeeLog || []).slice(0, 12).map((e, i) => (
              <li
                key={`${e.at}-${i}`}
                className="flex items-center justify-between gap-2 rounded-xl bg-black/25 px-3 py-2"
              >
                <span className="text-white/55">
                  {e.winnerName} · pot {e.grossPot.toLocaleString()}
                </span>
                <span className="font-mono font-semibold text-amber-300">
                  +{e.adminFee.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
          <strong className="font-semibold">API:</strong> {error}
          <span className="mt-1 block text-amber-100/70">
            Need admin JWT (isAdmin). Local device data may still appear below.
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {cards.map(({ label, value, icon: Icon, sub, tone }) => (
              <div
                key={label}
                className={`rounded-2xl border border-white/10 bg-gradient-to-b ${tone} p-4 shadow-lg shadow-black/20`}
              >
                <div className="flex items-center gap-2 text-white/45">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/30">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
                </div>
                <p className="mt-3 text-2xl font-black tabular-nums tracking-tight text-white">
                  {value}
                </p>
                <p className="mt-0.5 text-[11px] text-white/40">{sub}</p>
              </div>
            ))}
          </div>

          {data?.signupsByDay && data.signupsByDay.length > 0 && (
            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-white/85">Signups · last 7 days</h2>
                <span className="text-[11px] text-white/35">Daily new accounts</span>
              </div>
              <div className="flex h-36 items-end gap-2.5">
                {data.signupsByDay.map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                    <span className="text-[11px] font-semibold tabular-nums text-amber-200/80">
                      {d.count}
                    </span>
                    <div
                      className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-amber-700 to-amber-400 shadow-md shadow-amber-500/20"
                      style={{
                        height: `${Math.max(8, (d.count / maxSignups) * 100)}%`,
                        minHeight: 8,
                      }}
                    />
                    <span className="text-[10px] text-white/35">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            {data?.recentUsers && data.recentUsers.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white/85">Recent users</h2>
                  <Link
                    href="/admin/users"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300/90 hover:text-amber-200"
                  >
                    Manage <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <ul className="divide-y divide-white/5">
                  {data.recentUsers.map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-equb-500/20 text-sm font-bold text-equb-300">
                          {(u.fullName || u.phone || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {u.fullName || u.phone || u.email}
                          </p>
                          <p className="truncate font-mono text-[11px] text-white/35">
                            {u.phone || u.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
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
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white/85">Audit stream</h2>
                  <Link
                    href="/admin/audit"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300/90"
                  >
                    Full log <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <ul className="space-y-2">
                  {data.recentAudit.slice(0, 8).map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/30 px-3 py-2.5 text-xs"
                    >
                      <span className="font-semibold text-amber-100/95">{a.action}</span>
                      <span className="shrink-0 text-white/30">
                        {new Date(a.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!data && local.users.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:col-span-2">
                <h2 className="mb-3 text-sm font-bold text-white/85">Local accounts (this device)</h2>
                <ul className="divide-y divide-white/5 text-sm">
                  {local.users.map((u) => (
                    <li key={String(u.id)} className="flex justify-between py-3">
                      <div>
                        <p className="font-medium">{String(u.fullName)}</p>
                        <p className="font-mono text-[11px] text-white/35">{String(u.phone)}</p>
                      </div>
                      <span className="font-semibold text-amber-300/90">{String(u.balance)}</span>
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
