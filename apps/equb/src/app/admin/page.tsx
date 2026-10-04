'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Coins,
  Gamepad2,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const user = useEqubStore((s) => s.user);
  const adminEarningsTotal = useEqubStore((s) => s.adminEarningsTotal ?? 0);
  const adminFeeLog = useEqubStore((s) => s.adminFeeLog ?? []);
  const history = useEqubStore((s) => s.history ?? []);
  const rooms = useEqubStore((s) => s.rooms ?? []);

  const [data, setData] = useState<AdminDashboard | null>(null);
  const [local, setLocal] = useState(localAdminSnapshot());
  const [error, setError] = useState('');
  const [apiLoading, setApiLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (soft = false) => {
    setLocal(localAdminSnapshot());
    if (!isApiConfigured()) {
      setError('');
      setApiLoading(false);
      return;
    }
    if (soft) setRefreshing(true);
    else setApiLoading(true);
    setError('');
    try {
      const d = await fetchAdminDashboard();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setApiLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const feeRows = useMemo(() => {
    if (adminFeeLog.length) {
      return adminFeeLog.map((e) => ({
        roomId: e.roomId,
        winnerName: e.winnerName,
        grossPot: Number(e.grossPot) || 0,
        winnerPayout: Number(e.winnerPayout) || 0,
        adminFee: Number(e.adminFee) || 0,
        at: e.at,
      }));
    }
    return history
      .filter((h) => typeof (h as { adminFee?: number }).adminFee === 'number')
      .map((h) => {
        const row = h as {
          roomId: string;
          winnerName: string;
          amount: number;
          winnerPayout?: number;
          adminFee: number;
          at: number;
        };
        return {
          roomId: row.roomId,
          winnerName: row.winnerName,
          grossPot: Number(row.amount) || 0,
          winnerPayout:
            Number(row.winnerPayout) ||
            Math.round(row.amount * (1 - ADMIN_FEE_RATE) * 100) / 100,
          adminFee: Number(row.adminFee) || 0,
          at: row.at,
        };
      });
  }, [adminFeeLog, history]);

  const totalFees =
    Number(adminEarningsTotal) > 0
      ? Number(adminEarningsTotal)
      : feeRows.reduce((s, r) => s + r.adminFee, 0);
  const totalPots = feeRows.reduce((s, r) => s + r.grossPot, 0);
  const totalWinner = feeRows.reduce((s, r) => s + r.winnerPayout, 0);
  const gamesCount = feeRows.length || history.length;
  const avgFee = feeRows.length
    ? Math.round((totalFees / feeRows.length) * 100) / 100
    : 0;
  const feePct = Math.round(ADMIN_FEE_RATE * 100);
  const openRooms = rooms.filter((r) => r.status === 'open').length;
  const completedRooms = rooms.filter((r) => r.status === 'completed').length;

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

  const maxSignups = Math.max(
    1,
    ...(data?.signupsByDay?.map((d) => d.count) || [1]),
  );

  const localCards = [
    {
      label: 'Admin fees',
      value: totalFees.toLocaleString(),
      icon: Percent,
      sub: `${feePct}% of every pot`,
      tone: 'from-amber-500/25 to-transparent',
    },
    {
      label: 'Games played',
      value: gamesCount,
      icon: Gamepad2,
      sub: `${openRooms} open · ${completedRooms} done`,
      tone: 'from-violet-500/20 to-transparent',
    },
    {
      label: 'Gross pots',
      value: totalPots.toLocaleString(),
      icon: Wallet,
      sub: `Winners ${totalWinner.toLocaleString()}`,
      tone: 'from-emerald-500/20 to-transparent',
    },
    {
      label: 'Local accounts',
      value: local.total,
      icon: Users,
      sub: 'This browser',
      tone: 'from-sky-500/20 to-transparent',
    },
  ];

  const apiCards = data
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
    : localCards;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/45">
          {data ? 'Live API + local game fees' : 'Local game fees · API optional'}
        </p>
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

      {/* Always-visible fee board */}
      <section className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-amber-950/25 to-transparent p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500 text-black">
            <Percent className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-amber-50">
              Admin fees · {feePct}% of every pot
            </h2>
            <p className="text-[11px] text-white/40">
              Winner 85% · platform {feePct}% · works without API
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-amber-500/20 bg-black/30 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-200/60">
              Total admin fees
            </p>
            <p className="mt-1 text-2xl font-black tabular-nums text-amber-100">
              {totalFees.toLocaleString()}
            </p>
            <p className="text-[10px] text-white/35">Birr</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Games</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">{gamesCount}</p>
            <p className="text-[10px] text-white/35">completed draws</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Avg / game</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">
              {avgFee.toLocaleString()}
            </p>
            <p className="text-[10px] text-white/35">Birr fee</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Gross pots</p>
            <p className="mt-1 text-2xl font-black tabular-nums text-white">
              {totalPots.toLocaleString()}
            </p>
            <p className="text-[10px] text-white/35">
              winners {totalWinner.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/50">
            <Coins className="h-3.5 w-3.5" />
            Per-game breakdown
          </div>

          {feeRows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center text-xs text-white/40">
              No completed games yet. Play a full room draw — the 15% fee will show here.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-black/40 text-[10px] uppercase tracking-wide text-white/40">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Time</th>
                    <th className="px-3 py-2.5 font-semibold">Room</th>
                    <th className="px-3 py-2.5 font-semibold">Winner</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Pot</th>
                    <th className="px-3 py-2.5 font-semibold text-right">Winner 85%</th>
                    <th className="px-3 py-2.5 font-semibold text-right text-amber-200/80">
                      Admin {feePct}%
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {feeRows.map((r, i) => (
                    <tr
                      key={`${r.at}-${r.roomId}-${i}`}
                      className="bg-black/20 hover:bg-white/[0.03]"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-white/40">
                        {new Date(r.at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="max-w-[120px] truncate px-3 py-2.5 font-mono text-white/50">
                        {String(r.roomId).replace(/^equb-/, '')}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-white/75">
                        {r.winnerName}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-white/60">
                        {r.grossPot.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-equb-300/90">
                        {r.winnerPayout.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-amber-300">
                        +{r.adminFee.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-amber-500/20 bg-amber-500/10">
                  <tr className="font-bold">
                    <td className="px-3 py-2.5 text-amber-100/90" colSpan={3}>
                      Total ({feeRows.length} games)
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-white/70">
                      {totalPots.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-equb-300">
                      {totalWinner.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-amber-200">
                      {totalFees.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100">
          <strong className="font-semibold">API:</strong> {error}
          <span className="mt-1 block text-amber-100/70">
            Local fees above still work. For full user management, deploy API + seed admin
            (0918006053 / Admin123!).
          </span>
        </div>
      )}

      {!isApiConfigured() && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-white/45">
          <code className="text-amber-200/80">NEXT_PUBLIC_API_URL</code> not set — showing
          device data only.
        </div>
      )}

      {apiLoading && !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {apiCards.map(({ label, value, icon: Icon, sub, tone }) => (
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
      )}

      {data?.signupsByDay && data.signupsByDay.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white/85">Signups · last 7 days</h2>
          </div>
          <div className="flex h-36 items-end gap-2.5">
            {data.signupsByDay.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] font-semibold tabular-nums text-amber-200/80">
                  {d.count}
                </span>
                <div
                  className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-amber-700 to-amber-400"
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

      {data?.recentUsers && data.recentUsers.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white/85">Recent users</h2>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300/90"
            >
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y divide-white/5">
            {data.recentUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {u.fullName || u.phone || u.email}
                  </p>
                  <p className="truncate font-mono text-[11px] text-white/35">
                    {u.phone || u.email}
                  </p>
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

      {!data && local.users.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
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
  );
}
