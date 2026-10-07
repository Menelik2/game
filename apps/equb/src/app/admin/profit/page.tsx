'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp,
  Calendar,
  CalendarDays,
  CalendarRange,
  Coins,
  RefreshCw,
  Settings2,
  Gamepad2,
} from 'lucide-react';
import clsx from 'clsx';
import { adminFetch } from '@/lib/admin-fetch';

type Period = {
  profit: number;
  games: number;
  grossPot: number;
  winnerPayout: number;
};

type GameRow = {
  id: string;
  roomId: string;
  templateId: string;
  groupSize: number;
  grossPot: number;
  adminFee: number;
  winnerPayout: number;
  feeRate: number;
  winnerName: string | null;
  winningNumber: number | null;
  seatsTaken: number;
  completedAt: string;
};

type Analytics = {
  feeRate: number;
  feePercent: number;
  perGame: GameRow[];
  daily: Period;
  weekly: Period;
  monthly: Period;
  total: Period;
  byTemplate: Array<{ templateId: string; profit: number; games: number }>;
};

function etb(n: number) {
  return `${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ETB`;
}

export default function AdminProfitPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [feePercent, setFeePercent] = useState('15');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/profit?limit=80');
      const json = await res.json();
      if (json.success) {
        setAnalytics(json.data.analytics);
        setFeePercent(String(json.data.settings?.platformFeeRate * 100 ?? 15));
        setMsg('');
      } else {
        setMsg(json.message || 'Failed to load');
      }
    } catch {
      setMsg('Network error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const iv = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(iv);
  }, [load]);

  async function saveFee() {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/profit', {
        method: 'PATCH',
        body: JSON.stringify({ platformFeeRate: Number(feePercent) / 100 }),
      });
      const json = await res.json();
      if (json.success) {
        setAnalytics(json.data.analytics);
        setMsg(json.message || 'Saved');
      } else setMsg(json.message || 'Save failed');
    } catch {
      setMsg('Save failed');
    }
    setSaving(false);
  }

  const cards = analytics
    ? [
        {
          label: 'Today (UTC)',
          period: analytics.daily,
          icon: Calendar,
          accent: 'text-equb-300',
        },
        {
          label: 'Last 7 days',
          period: analytics.weekly,
          icon: CalendarDays,
          accent: 'text-sky-300',
        },
        {
          label: 'This month',
          period: analytics.monthly,
          icon: CalendarRange,
          accent: 'text-violet-300',
        },
        {
          label: 'Lifetime',
          period: analytics.total,
          icon: Coins,
          accent: 'text-gold-400',
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">
            Finance
          </p>
          <h2 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <TrendingUp className="h-6 w-6 text-gold-400" />
            Profit analytics
          </h2>
          <p className="text-sm text-white/40">
            Platform fee from completed live games · not mock data
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/70"
        >
          <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {msg && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
          {msg}
        </p>
      )}

      {/* Prize settings */}
      <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-amber-300" />
          <h3 className="text-sm font-bold text-amber-100">Prize settings</h3>
        </div>
        <p className="mb-3 text-xs text-white/45">
          Platform keeps this % of each completed pot; the rest goes to the
          winner. New games use the rate immediately.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-white/50">
            Platform fee %
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={feePercent}
              onChange={(e) => setFeePercent(e.target.value)}
              className="mt-1 block w-28 rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-amber-500/40"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveFee()}
            className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save fee rate'}
          </button>
          {analytics && (
            <p className="text-xs text-white/40">
              Active: <span className="font-semibold text-gold-400">{analytics.feePercent}%</span>
            </p>
          )}
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <article
            key={c.label}
            className="rounded-2xl border border-white/10 bg-black/30 p-4"
          >
            <div className="flex items-center justify-between text-white/40">
              <p className="text-[11px] uppercase tracking-wide">{c.label}</p>
              <c.icon className={clsx('h-4 w-4', c.accent)} />
            </div>
            <p className={clsx('mt-2 text-xl font-black tabular-nums sm:text-2xl', c.accent)}>
              {etb(c.period.profit)}
            </p>
            <p className="mt-1 text-[11px] text-white/35">
              {c.period.games} game{c.period.games === 1 ? '' : 's'} · pot{' '}
              {etb(c.period.grossPot)}
            </p>
          </article>
        ))}
      </section>

      {/* Per game */}
      <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Gamepad2 className="h-4 w-4 text-equb-300" />
          <h3 className="text-sm font-bold">Profit per game</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-[10px] uppercase text-white/40">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-2">When (UTC)</th>
                <th className="py-2 pr-2">Room</th>
                <th className="py-2 pr-2">Winner</th>
                <th className="py-2 pr-2 text-right">Pot</th>
                <th className="py-2 pr-2 text-right">Winner pay</th>
                <th className="py-2 text-right text-gold-400">Platform</th>
              </tr>
            </thead>
            <tbody>
              {(analytics?.perGame || []).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-white/30">
                    No completed fee-bearing games yet. Profit appears after live
                    draws with real players.
                  </td>
                </tr>
              )}
              {(analytics?.perGame || []).map((g) => (
                <tr key={g.id} className="border-b border-white/5">
                  <td className="py-2 pr-2 font-mono text-white/50">
                    {g.completedAt.replace('T', ' ').slice(0, 19)}
                  </td>
                  <td className="py-2 pr-2">
                    <span className="font-medium">{g.templateId}</span>
                    <span className="ml-1 text-white/30">
                      · {g.seatsTaken}/{g.groupSize}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    {g.winnerName || '—'}{' '}
                    {g.winningNumber != null && (
                      <span className="font-mono text-gold-400/80">
                        #{String(g.winningNumber).padStart(2, '0')}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{etb(g.grossPot)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums text-equb-300/90">
                    {etb(g.winnerPayout)}
                  </td>
                  <td className="py-2 text-right font-bold tabular-nums text-gold-400">
                    {etb(g.adminFee)}
                    <span className="ml-1 text-[10px] font-normal text-white/30">
                      ({Math.round(g.feeRate * 100)}%)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* By template */}
      {(analytics?.byTemplate?.length || 0) > 0 && (
        <section className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <h3 className="mb-3 text-sm font-bold">Profit by room type</h3>
          <ul className="space-y-1.5 text-sm">
            {analytics!.byTemplate.slice(0, 15).map((t) => (
              <li
                key={t.templateId}
                className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-2"
              >
                <span className="text-white/70">{t.templateId}</span>
                <span className="font-mono text-gold-400">
                  {etb(t.profit)}
                  <span className="ml-2 text-[11px] text-white/35">
                    {t.games}g
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
