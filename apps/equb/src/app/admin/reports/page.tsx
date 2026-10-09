'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatBirrCompact } from '@/lib/money';
import {
  BarChart3,
  RefreshCw,
  Users,
  Trophy,
  Wallet,
  Gamepad2,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';

type ReportData = {
  generatedAt: string;
  users: {
    total: number;
    players: number;
    admins: number;
    banned: number;
    totalBalance: number;
  };
  games: {
    liveRooms: number;
    openRooms: number;
    livePlayers: number;
    completedTracked: number;
  };
  profit: {
    feePercent: number;
    daily: { profit: number; games: number; grossPot: number };
    weekly: { profit: number; games: number; grossPot: number };
    monthly: { profit: number; games: number; grossPot: number };
    total: { profit: number; games: number; grossPot: number };
    byTemplate: Array<{ templateId: string; profit: number; games: number }>;
  };
  topBalances: Array<{
    id: string;
    name: string;
    phone: string;
    balance: number;
    role?: string;
    banned?: boolean;
  }>;
  recentWinners: Array<{
    roomId: string;
    templateId: string;
    winnerName: string | null;
    winnerPayout: number;
    adminFee: number;
    winningNumber: number | null;
    completedAt: string;
  }>;
};

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/reports');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setMsg('');
      } else {
        setMsg(json.message || 'Failed to load');
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 20000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-amber-50">
            <BarChart3 className="h-5 w-5 text-amber-400" />
            Reports & Analytics
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Users · live games · profit · top balances · winners
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

      {msg && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {msg}
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                label: 'Users',
                value: data.users.total,
                sub: `${data.users.banned} banned`,
                icon: Users,
                color: 'text-cyan-300',
              },
              {
                label: 'Wallet total',
                value: formatBirrCompact(data.users.totalBalance, 'am'),
                sub: `${data.users.players} players`,
                icon: Wallet,
                color: 'text-equb-300',
              },
              {
                label: 'Open rooms',
                value: data.games.openRooms,
                sub: `${data.games.livePlayers} in-game`,
                icon: Gamepad2,
                color: 'text-amber-300',
              },
              {
                label: 'Lifetime profit',
                value: formatBirrCompact(data.profit.total.profit, 'am'),
                sub: `${data.profit.total.games} games · ${data.profit.feePercent}% fee`,
                icon: Trophy,
                color: 'text-gold-300',
              },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3"
              >
                <c.icon className={clsx('mb-1 h-4 w-4', c.color)} />
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  {c.label}
                </p>
                <p className={clsx('mt-0.5 font-mono text-lg font-black', c.color)}>
                  {c.value}
                </p>
                <p className="text-[10px] text-white/35">{c.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['Today', data.profit.daily],
                ['7 days', data.profit.weekly],
                ['Month', data.profit.monthly],
              ] as const
            ).map(([label, p]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
              >
                <p className="text-[10px] font-bold uppercase text-white/40">
                  {label}
                </p>
                <p className="mt-1 font-mono text-xl font-black text-gold-300">
                  {formatBirrCompact(p.profit, 'am')}
                </p>
                <p className="text-[11px] text-white/40">
                  {p.games} games · pot {formatBirrCompact(p.grossPot, 'am')}
                </p>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <h3 className="mb-3 text-sm font-bold text-white">Top balances</h3>
            <ul className="space-y-1.5">
              {data.topBalances.map((u, i) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-black/25 px-3 py-2 text-xs"
                >
                  <span>
                    <span className="mr-2 text-white/30">{i + 1}.</span>
                    <span className="font-semibold text-white">{u.name}</span>
                    <span className="ml-2 font-mono text-white/35">{u.phone}</span>
                    {u.banned && (
                      <span className="ml-2 text-red-400">banned</span>
                    )}
                  </span>
                  <span className="font-mono font-bold text-equb-300">
                    {formatBirrCompact(u.balance, 'am')}
                  </span>
                </li>
              ))}
              {data.topBalances.length === 0 && (
                <p className="text-xs text-white/35">No users yet</p>
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <h3 className="mb-3 text-sm font-bold text-white">Recent winners</h3>
            <ul className="space-y-1.5">
              {data.recentWinners.map((w) => (
                <li
                  key={w.roomId + w.completedAt}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/25 px-3 py-2 text-xs"
                >
                  <span>
                    <span className="font-semibold text-gold-200">
                      {w.winnerName}
                    </span>
                    <span className="ml-2 text-white/35">{w.templateId}</span>
                    {w.winningNumber != null && (
                      <span className="ml-2 font-mono text-white/50">
                        #{w.winningNumber}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-equb-300">
                    +{formatBirrCompact(w.winnerPayout, 'am')}
                  </span>
                </li>
              ))}
              {data.recentWinners.length === 0 && (
                <p className="text-xs text-white/35">No completed games tracked yet</p>
              )}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
