'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import {
  Shield,
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
  AlertTriangle,
  TrendingUp,
  Activity,
  CheckCircle2,
  XCircle,
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
  createdAt?: string;
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
  userId?: string;
  amount: number;
  status: string;
  phone?: string;
  createdAt?: string;
  transactionNumber?: string;
};

type LiveRoom = {
  id: string;
  templateId?: string;
  groupSize: number;
  prizePool: number;
  status: string;
  members?: { playerId: string; name: string }[];
  secondsLeft?: number;
  winnerName?: string | null;
};

function isAdmin(user: unknown) {
  return (
    !!user &&
    typeof user === 'object' &&
    (user as { role?: string }).role === 'admin'
  );
}

function displayName(u: U) {
  return u.fullName || u.name || 'User';
}

export default function AdminPage() {
  const router = useRouter();
  const me = useEqubStore((s) => s.user);

  const [tab, setTab] = useState<
    'overview' | 'users' | 'create' | 'deposits' | 'rooms'
  >('overview');
  const [users, setUsers] = useState<U[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'player' | 'admin' | 'banned'>(
    'all',
  );
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );
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
      } else flash('err', json?.message || 'Could not load users');
    } catch {
      flash('err', 'Network error loading users');
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

  const loadRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/equb/rooms', { cache: 'no-store' });
      const json = await res.json();
      if (json?.success || Array.isArray(json?.data)) {
        setRooms(json.data || json.rooms || []);
      }
    } catch {
      setRooms([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadUsers(), loadDeposits(), loadRooms()]);
    setLoading(false);
  }, [loadUsers, loadDeposits, loadRooms]);

  useEffect(() => {
    void refreshAll();
    const iv = window.setInterval(() => void refreshAll(), 15000);
    return () => window.clearInterval(iv);
  }, [refreshAll]);

  useEffect(() => {
    if (me && !isAdmin(me)) router.replace('/');
  }, [me, router]);

  const filtered = useMemo(() => {
    let list = users;
    if (roleFilter === 'admin') list = list.filter((u) => u.role === 'admin');
    if (roleFilter === 'player')
      list = list.filter((u) => u.role !== 'admin' && !u.banned);
    if (roleFilter === 'banned') list = list.filter((u) => u.banned);
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((u) =>
      `${displayName(u)} ${u.phone} ${u.role}`
        .toLowerCase()
        .includes(s),
    );
  }, [users, q, roleFilter]);

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
        flash('ok', `Account created for ${form.fullName}`);
        setForm({
          fullName: '',
          phone: '',
          password: '123456',
          balance: '100',
          role: 'player',
        });
        await loadUsers();
        setTab('users');
      } else flash('err', json.message || 'Create failed');
    } catch {
      flash('err', 'Create failed');
    }
    setBusy(false);
  }

  async function patch(
    id: string,
    body: Record<string, unknown>,
    ok: string,
  ) {
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
    if (!confirm(`Delete account "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        flash('ok', 'Account deleted');
        await loadUsers();
      } else flash('err', json.message || 'Delete failed');
    } catch {
      flash('err', 'Delete failed');
    }
  }

  if (!me) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 py-20 text-center">
        <Shield className="mx-auto h-10 w-10 text-amber-400/50" />
        <p className="mt-3 text-sm text-white/50">Sign in as admin to continue</p>
        <Link href="/profile" className="mt-4 inline-block text-sm text-amber-300 underline">
          Go to login
        </Link>
      </div>
    );
  }
  if (!isAdmin(me)) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 py-20 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
        <p className="mt-3 text-sm text-red-200">Admin access only</p>
      </div>
    );
  }

  const cards = [
    {
      label: 'Total players',
      value: stats?.users ?? '—',
      icon: Users,
      accent: 'text-equb-300',
      bg: 'from-equb-500/15',
    },
    {
      label: 'Admins',
      value: stats?.admins ?? '—',
      icon: Crown,
      accent: 'text-amber-300',
      bg: 'from-amber-500/15',
    },
    {
      label: 'Banned',
      value: stats?.banned ?? '—',
      icon: Ban,
      accent: 'text-red-300',
      bg: 'from-red-500/15',
    },
    {
      label: 'Total float',
      value: stats
        ? `${Number(stats.totalBalance).toLocaleString()} ETB`
        : '—',
      icon: Wallet,
      accent: 'text-gold-400',
      bg: 'from-gold-500/15',
    },
    {
      label: 'Deposits',
      value: stats?.deposits ?? deposits.length,
      icon: Landmark,
      accent: 'text-sky-300',
      bg: 'from-sky-500/15',
    },
    {
      label: 'Pending pay',
      value: stats?.pendingDeposits ?? '—',
      icon: Clock,
      accent: 'text-orange-300',
      bg: 'from-orange-500/15',
    },
  ];

  const pendingDeps = deposits.filter(
    (d) => d.status === 'PENDING' || d.status === 'PROCESSING' || d.status === 'REVIEW_REQUIRED',
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">
            Control room
          </p>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            Operations dashboard
          </h2>
          <p className="text-sm text-white/40">
            Signed in as {me.name || me.phone} · auto-refresh 15s
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.04] p-1 text-sm sm:grid-cols-5">
        {(
          [
            ['overview', 'Overview'],
            ['users', 'Accounts'],
            ['create', 'New'],
            ['deposits', 'Deposits'],
            ['rooms', 'Rooms'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx(
              'rounded-xl py-2.5 font-semibold transition',
              tab === id
                ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20'
                : 'text-white/55 hover:text-white/80',
            )}
          >
            {label}
            {id === 'deposits' && pendingDeps.length > 0 && (
              <span className="ml-1 rounded-full bg-red-500 px-1.5 text-[10px] text-white">
                {pendingDeps.length}
              </span>
            )}
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
          {msg.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          {msg.text}
        </p>
      )}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {cards.map((c) => (
              <article
                key={c.label}
                className={clsx(
                  'rounded-2xl border border-white/10 bg-gradient-to-b to-transparent p-4',
                  c.bg,
                )}
              >
                <div className="flex items-center justify-between text-white/40">
                  <p className="text-[11px] uppercase tracking-wide">{c.label}</p>
                  <c.icon className={clsx('h-4 w-4', c.accent)} />
                </div>
                <p
                  className={clsx(
                    'mt-3 text-2xl font-bold tabular-nums',
                    c.accent,
                  )}
                >
                  {c.value}
                </p>
              </article>
            ))}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Quick actions */}
            <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/40">
                <Activity className="h-3.5 w-3.5" /> Quick actions
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTab('create')}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-left text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20"
                >
                  <UserPlus className="h-4 w-4" /> New account
                </button>
                <button
                  type="button"
                  onClick={() => setTab('users')}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  <Users className="h-4 w-4" /> Manage users
                </button>
                <button
                  type="button"
                  onClick={() => setTab('deposits')}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  <Landmark className="h-4 w-4" /> Review deposits
                </button>
                <Link
                  href="/admin/audit"
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  <TrendingUp className="h-4 w-4" /> Audit log
                </Link>
              </div>
            </section>

            {/* Recent users */}
            <section className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">
                Latest accounts
              </p>
              <ul className="space-y-2">
                {users.slice(0, 6).map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {displayName(u)}
                        {u.role === 'admin' && (
                          <span className="ml-1.5 text-[10px] text-amber-400">
                            ADMIN
                          </span>
                        )}
                        {u.banned && (
                          <span className="ml-1.5 text-[10px] text-red-400">
                            BANNED
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-white/35">{u.phone}</p>
                    </div>
                    <p className="font-mono text-sm font-bold text-gold-400">
                      {Number(u.balance || 0).toLocaleString()}
                    </p>
                  </li>
                ))}
                {users.length === 0 && (
                  <li className="py-6 text-center text-sm text-white/30">
                    No users yet
                  </li>
                )}
              </ul>
            </section>
          </div>

          {pendingDeps.length > 0 && (
            <section className="rounded-2xl border border-orange-500/25 bg-orange-500/10 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-bold text-orange-200">
                <AlertTriangle className="h-4 w-4" />
                {pendingDeps.length} deposit(s) need review
              </p>
              <button
                type="button"
                onClick={() => setTab('deposits')}
                className="text-xs font-semibold text-orange-300 underline"
              >
                Open deposits tab →
              </button>
            </section>
          )}
        </div>
      )}

      {/* ── CREATE ── */}
      {tab === 'create' && (
        <form
          className="mx-auto max-w-md space-y-3 rounded-2xl border border-white/10 bg-black/30 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void createUser();
          }}
        >
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-bold">Create account</h2>
          </div>
          <p className="text-xs text-white/40">
            Full name, phone & password. Default balance 100 ETB.
          </p>
          {(
            [
              ['fullName', 'Full name', 'text'],
              ['phone', 'Phone number', 'tel'],
              ['password', 'Password', 'text'],
              ['balance', 'Opening balance (ETB)', 'number'],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="block text-xs text-white/50">
              {label}
              <input
                required={key !== 'balance'}
                type={type}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/40"
              />
            </label>
          ))}
          <label className="block text-xs text-white/50">
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500/40"
            >
              <option value="player">Player</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-black shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {busy ? 'Saving…' : 'Create account'}
          </button>
        </form>
      )}

      {/* ── USERS ── */}
      {tab === 'users' && (
        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or phone…"
                className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-amber-500/40"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'player', 'admin', 'banned'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setRoleFilter(f)}
                  className={clsx(
                    'rounded-xl px-3 py-2 text-xs font-semibold capitalize',
                    roleFilter === f
                      ? 'bg-amber-400 text-black'
                      : 'bg-white/5 text-white/50',
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-white/35">
            Showing {filtered.length} of {users.length} accounts
          </p>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            {filtered.map((u) => (
              <div
                key={u.id}
                className={clsx(
                  'border-b border-white/5 px-4 py-3.5 last:border-0',
                  u.banned && 'bg-red-500/5',
                  u.role === 'admin' && 'bg-amber-500/5',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 truncate font-semibold">
                      {displayName(u)}
                      {u.role === 'admin' && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-300">
                          Admin
                        </span>
                      )}
                      {u.banned && (
                        <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-300">
                          Banned
                        </span>
                      )}
                    </p>
                    <p className="font-mono text-xs text-white/40">{u.phone}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-white/25">
                      {u.id.slice(0, 8)}…
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums text-gold-400">
                      {Number(u.balance || 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-white/35">ETB</p>
                  </div>
                </div>

                {/* Balance adjust */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    className="rounded-full bg-equb-500/20 px-3 py-1 text-xs font-bold text-equb-300"
                    onClick={() =>
                      void patch(
                        u.id,
                        { balance: Number(u.balance) + 100 },
                        `+100 ETB → ${displayName(u)}`,
                      )
                    }
                  >
                    +100
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-equb-500/20 px-3 py-1 text-xs font-bold text-equb-300"
                    onClick={() =>
                      void patch(
                        u.id,
                        { balance: Number(u.balance) + 500 },
                        `+500 ETB → ${displayName(u)}`,
                      )
                    }
                  >
                    +500
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-white/10 px-3 py-1 text-xs"
                    onClick={() =>
                      void patch(
                        u.id,
                        {
                          balance: Math.max(
                            0,
                            Number(u.balance) - 100,
                          ),
                        },
                        `-100 ETB → ${displayName(u)}`,
                      )
                    }
                  >
                    −100
                  </button>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      placeholder="Set"
                      value={balanceDraft[u.id] ?? ''}
                      onChange={(e) =>
                        setBalanceDraft((d) => ({
                          ...d,
                          [u.id]: e.target.value,
                        }))
                      }
                      className="w-20 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-xs outline-none"
                    />
                    <button
                      type="button"
                      className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-bold text-amber-200"
                      onClick={() => {
                        const n = Number(balanceDraft[u.id]);
                        if (Number.isFinite(n) && n >= 0) {
                          void patch(u.id, { balance: n }, 'Balance set');
                          setBalanceDraft((d) => {
                            const next = { ...d };
                            delete next[u.id];
                            return next;
                          });
                        }
                      }}
                    >
                      Set
                    </button>
                  </div>
                </div>

                {/* Role / ban / delete */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="rounded-full bg-white/10 px-3 py-1 text-xs"
                    onClick={() =>
                      void patch(
                        u.id,
                        { banned: !u.banned },
                        u.banned ? 'Unbanned' : 'Banned',
                      )
                    }
                  >
                    {u.banned ? 'Unban' : 'Ban'}
                  </button>
                  <button
                    type="button"
                    className="rounded-full bg-white/10 px-3 py-1 text-xs"
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
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-3 py-1 text-xs text-red-200"
                    onClick={() => void remove(u.id, displayName(u))}
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-12 text-center text-sm text-white/40">
                No accounts match your filters.
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── DEPOSITS ── */}
      {tab === 'deposits' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/50">
              {deposits.length} total · {pendingDeps.length} pending
            </p>
            <Link
              href="/admin/deposits"
              className="text-xs text-amber-300 underline"
            >
              Full deposits page
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {deposits.length === 0 && (
              <p className="px-4 py-12 text-center text-sm text-white/35">
                No deposit records yet.
              </p>
            )}
            {deposits.slice(0, 30).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between border-b border-white/5 px-4 py-3 last:border-0"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold text-gold-400">
                    {Number(d.amount).toLocaleString()} ETB
                  </p>
                  <p className="truncate text-[11px] text-white/35">
                    {d.phone || d.userId?.slice(0, 8) || '—'} ·{' '}
                    {d.transactionNumber || d.id.slice(0, 8)}
                  </p>
                </div>
                <span
                  className={clsx(
                    'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
                    d.status === 'CONFIRMED' &&
                      'bg-equb-500/20 text-equb-300',
                    (d.status === 'PENDING' ||
                      d.status === 'PROCESSING') &&
                      'bg-orange-500/20 text-orange-300',
                    d.status === 'FAILED' && 'bg-red-500/20 text-red-300',
                    d.status === 'REVIEW_REQUIRED' &&
                      'bg-amber-500/20 text-amber-300',
                  )}
                >
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── ROOMS ── */}
      {tab === 'rooms' && (
        <section className="space-y-3">
          <p className="text-sm text-white/50">
            Live multiplayer rooms ({rooms.length})
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {rooms.length === 0 && (
              <p className="px-4 py-12 text-center text-sm text-white/35">
                No active rooms right now.
              </p>
            )}
            {rooms.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border-b border-white/5 px-4 py-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {r.groupSize} seats ·{' '}
                    <span className="text-gold-400">
                      {Number(r.prizePool).toLocaleString()} ETB
                    </span>
                  </p>
                  <p className="text-[11px] text-white/35">
                    {(r.members?.length || 0)} players · {r.status}
                    {r.secondsLeft != null && ` · ${r.secondsLeft}s`}
                    {r.winnerName && ` · winner ${r.winnerName}`}
                  </p>
                </div>
                <Link
                  href={`/rooms/${r.templateId || r.id}`}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70"
                >
                  Open
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
