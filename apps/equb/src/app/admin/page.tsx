'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import {
  Users,
  Ban,
  Wallet,
  Landmark,
  Clock,
  Search,
  Plus,
  RefreshCw,
  UserPlus,
  Trash2,
  Crown,
  Activity,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import clsx from 'clsx';

type U = {
  id: string;
  fullName?: string;
  name?: string;
  phone: string;
  balance: number;
  role?: string;
  banned?: boolean;
};

type Stats = {
  users: number;
  admins: number;
  banned: number;
  totalBalance: number;
  deposits: number;
  pendingDeposits: number;
};

type Deposit = {
  id: string;
  amount: number;
  status: string;
  createdAt?: string;
};

function isAdmin(user: unknown) {
  if (!user || typeof user !== 'object') return false;
  const u = user as { role?: string; phone?: string };
  if (u.role === 'admin') return true;
  const d = (u.phone || '').replace(/\D/g, '');
  return d === '900000000' || d === '251900000000' || d.endsWith('900000000');
}

function displayName(u: U) {
  return u.fullName || u.name || 'User';
}

export default function AdminPage() {
  const me = useEqubStore((s) => s.user);
  const [tab, setTab] = useState<'overview' | 'users' | 'create' | 'deposits'>('overview');
  const [users, setUsers] = useState<U[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    password: '123456',
    balance: '100',
    role: 'player',
  });
  const [balanceDraft, setBalanceDraft] = useState<Record<string, string>>({});

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    window.setTimeout(() => setMsg(null), 4000);
  };

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const json = await res.json();
      if (json?.success) {
        setUsers(json.data.users || []);
        setStats(json.data.stats);
      }
    } catch {
      flash('err', 'Could not load users');
    }
  }, []);

  const loadDeposits = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/deposits', { cache: 'no-store' });
      const json = await res.json();
      if (json?.success) setDeposits(json.data.items || []);
    } catch {
      /* optional */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadUsers(), loadDeposits()]);
    setLoading(false);
  }, [loadUsers, loadDeposits]);

  useEffect(() => {
    void refreshAll();
    const iv = window.setInterval(() => void refreshAll(), 15000);
    return () => window.clearInterval(iv);
  }, [refreshAll]);

  // Auth UI is handled by AdminGuard in layout — do not router.replace
  if (!me || !isAdmin(me)) return null;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) =>
      `${displayName(u)} ${u.phone} ${u.role}`.toLowerCase().includes(s),
    );
  }, [users, q]);

  async function createUser() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, balance: Number(form.balance) }),
      });
      const json = await res.json();
      if (json.success) {
        flash('ok', `Created ${form.fullName}`);
        setForm({ fullName: '', phone: '', password: '123456', balance: '100', role: 'player' });
        await loadUsers();
        setTab('users');
      } else flash('err', json.message || 'Create failed');
    } catch {
      flash('err', 'Create failed');
    }
    setBusy(false);
  }

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        flash('ok', ok);
        await loadUsers();
      } else flash('err', json.message || 'Update failed');
    } catch {
      flash('err', 'Update failed');
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        flash('ok', 'Deleted');
        await loadUsers();
      } else flash('err', json.message || 'Delete failed');
    } catch {
      flash('err', 'Delete failed');
    }
  }

  const cards = [
    { label: 'Players', value: stats?.users ?? '—', icon: Users, accent: 'text-equb-300' },
    { label: 'Admins', value: stats?.admins ?? '—', icon: Crown, accent: 'text-amber-300' },
    { label: 'Banned', value: stats?.banned ?? '—', icon: Ban, accent: 'text-red-300' },
    {
      label: 'Float',
      value: stats ? `${Number(stats.totalBalance).toLocaleString()} ETB` : '—',
      icon: Wallet,
      accent: 'text-gold-400',
    },
    { label: 'Deposits', value: stats?.deposits ?? deposits.length, icon: Landmark, accent: 'text-sky-300' },
    { label: 'Pending', value: stats?.pendingDeposits ?? '—', icon: Clock, accent: 'text-orange-300' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">
            Control room
          </p>
          <h2 className="text-xl font-bold sm:text-2xl">Operations dashboard</h2>
          <p className="text-sm text-white/40">
            {me.name || me.phone} · auto-refresh 15s
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/70"
        >
          <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.04] p-1 text-sm sm:grid-cols-4">
        {(['overview', 'users', 'create', 'deposits'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx(
              'rounded-xl py-2.5 font-semibold capitalize',
              tab === id ? 'bg-amber-400 text-black' : 'text-white/55',
            )}
          >
            {id}
          </button>
        ))}
      </div>

      {msg && (
        <p
          className={clsx(
            'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm',
            msg.type === 'ok'
              ? 'border-equb-500/30 bg-equb-500/10 text-equb-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200',
          )}
        >
          {msg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {msg.text}
        </p>
      )}

      {tab === 'overview' && (
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {cards.map((c) => (
              <article key={c.label} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between text-white/40">
                  <p className="text-[11px] uppercase">{c.label}</p>
                  <c.icon className={clsx('h-4 w-4', c.accent)} />
                </div>
                <p className={clsx('mt-3 text-2xl font-bold tabular-nums', c.accent)}>{c.value}</p>
              </article>
            ))}
          </section>
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setTab('create')} className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm font-semibold text-amber-100">
              <UserPlus className="h-4 w-4" /> New account
            </button>
            <Link href="/admin/telebirr" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white/80">
              <Landmark className="h-4 w-4" /> Telebirr wallet
            </Link>
            <Link href="/admin/audit" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white/80">
              <TrendingUp className="h-4 w-4" /> Audit log
            </Link>
            <button type="button" onClick={() => setTab('users')} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white/80">
              <Activity className="h-4 w-4" /> Manage users
            </button>
          </div>
        </div>
      )}

      {tab === 'create' && (
        <form
          className="mx-auto max-w-md space-y-3 rounded-2xl border border-white/10 bg-black/30 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void createUser();
          }}
        >
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <UserPlus className="h-5 w-5 text-amber-400" /> Create account
          </h2>
          {(['fullName', 'phone', 'password', 'balance'] as const).map((key) => (
            <label key={key} className="block text-xs text-white/50">
              {key}
              <input
                required={key !== 'balance'}
                type={key === 'balance' ? 'number' : 'text'}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-amber-500/40"
              />
            </label>
          ))}
          <label className="block text-xs text-white/50">
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm"
            >
              <option value="player">Player</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-black disabled:opacity-50">
            <Plus className="h-4 w-4" /> {busy ? 'Saving…' : 'Create'}
          </button>
        </form>
      )}

      {tab === 'users' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or phone"
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-amber-500/40"
            />
          </div>
          <ul className="space-y-2">
            {filtered.map((u) => (
              <li key={u.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {displayName(u)}
                      {u.role === 'admin' && (
                        <span className="ml-2 text-[10px] text-amber-400">ADMIN</span>
                      )}
                      {u.banned && (
                        <span className="ml-2 text-[10px] text-red-400">BANNED</span>
                      )}
                    </p>
                    <p className="font-mono text-xs text-white/40">{u.phone}</p>
                  </div>
                  <p className="font-mono font-bold text-gold-400">
                    {Number(u.balance || 0).toLocaleString()} ETB
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    type="number"
                    placeholder="Balance"
                    value={balanceDraft[u.id] ?? ''}
                    onChange={(e) =>
                      setBalanceDraft((d) => ({ ...d, [u.id]: e.target.value }))
                    }
                    className="w-28 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-equb-500/20 px-2 py-1.5 text-xs font-bold text-equb-200"
                    onClick={() =>
                      void patch(
                        u.id,
                        { balance: Number(balanceDraft[u.id]) },
                        'Balance updated',
                      )
                    }
                  >
                    Set
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-white/10 px-2 py-1.5 text-xs"
                    onClick={() =>
                      void patch(u.id, { banned: !u.banned }, u.banned ? 'Unbanned' : 'Banned')
                    }
                  >
                    {u.banned ? 'Unban' : 'Ban'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-amber-500/20 px-2 py-1.5 text-xs text-amber-200"
                    onClick={() =>
                      void patch(
                        u.id,
                        { role: u.role === 'admin' ? 'player' : 'admin' },
                        'Role updated',
                      )
                    }
                  >
                    {u.role === 'admin' ? 'Make player' : 'Make admin'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-red-500/20 px-2 py-1.5 text-xs text-red-200"
                    onClick={() => void remove(u.id, displayName(u))}
                  >
                    <Trash2 className="inline h-3 w-3" /> Delete
                  </button>
                </div>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="py-10 text-center text-sm text-white/30">No users</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'deposits' && (
        <ul className="space-y-2">
          {deposits.length === 0 && (
            <li className="py-10 text-center text-sm text-white/30">No deposits</li>
          )}
          {deposits.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3"
            >
              <span className="font-mono font-bold text-gold-400">
                {Number(d.amount).toLocaleString()} ETB
              </span>
              <span className="text-xs uppercase text-white/50">{d.status}</span>
            </li>
          ))}
          <li>
            <Link href="/admin/telebirr" className="text-sm text-amber-300 underline">
              Open Telebirr review →
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
