'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { adminFetch } from '@/lib/admin-fetch';
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
  KeyRound,
  History,
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

type HistoryRow = {
  kind: 'deposit' | 'ledger';
  id: string;
  userId: string;
  userName?: string | null;
  userPhone?: string | null;
  amount: number;
  delta: number;
  balance?: number;
  status: string;
  transactionNumber?: string | null;
  merchantOrderId?: string | null;
  failureReason?: string | null;
  createdAt?: string;
  confirmedAt?: string | null;
  reason?: string;
};

function isAdmin(user: unknown) {
  if (!user || typeof user !== 'object') return false;
  const u = user as { role?: string; phone?: string };
  if (u.role === 'admin') return true;
  const d = (u.phone || '').replace(/\D/g, '');
  return (
    d === '900000000' ||
    d === '251900000000' ||
    d.endsWith('900000000') ||
    d === '918006053' ||
    d.endsWith('918006053')
  );
}

function displayName(u: U) {
  return u.fullName || u.name || 'User';
}

function canReview(status: string) {
  return (
    status === 'PENDING' ||
    status === 'PROCESSING' ||
    status === 'REVIEW_REQUIRED'
  );
}

export default function AdminPage() {
  const me = useEqubStore((s) => s.user);
  const [tab, setTab] = useState<
    'overview' | 'users' | 'create' | 'deposits' | 'history'
  >('overview');
  const [users, setUsers] = useState<U[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [histSummary, setHistSummary] = useState({
    depositsPending: 0,
    depositsConfirmed: 0,
    depositsVolume: 0,
  });
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    password: '',
    balance: '0',
    role: 'player',
  });
  const [balanceDraft, setBalanceDraft] = useState<Record<string, string>>({});
  const [pwDraft, setPwDraft] = useState<Record<string, string>>({});
  const [phoneDraft, setPhoneDraft] = useState<Record<string, string>>({});

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text });
    window.setTimeout(() => setMsg(null), 4000);
  };

  const loadUsers = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/users');
      const json = await res.json();
      if (json?.success) {
        setUsers(json.data.users || []);
        setStats(json.data.stats);
      } else if (res.status === 401 || res.status === 403) {
        flash('err', json.message || 'Admin access denied');
      }
    } catch {
      flash('err', 'Could not load users');
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/wallet-history?limit=100');
      const json = await res.json();
      if (json?.success) {
        setHistory(json.data.items || []);
        setHistSummary({
          depositsPending: json.data.summary?.depositsPending ?? 0,
          depositsConfirmed: json.data.summary?.depositsConfirmed ?? 0,
          depositsVolume: json.data.summary?.depositsVolume ?? 0,
        });
      }
    } catch {
      /* optional */
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadUsers(), loadHistory()]);
    setLoading(false);
  }, [loadUsers, loadHistory]);

  useEffect(() => {
    void refreshAll();
    const iv = window.setInterval(() => void refreshAll(), 15000);
    return () => window.clearInterval(iv);
  }, [refreshAll]);

  if (!me || !isAdmin(me)) return null;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) =>
      `${displayName(u)} ${u.phone} ${u.role}`.toLowerCase().includes(s),
    );
  }, [users, q]);

  const depositRows = useMemo(
    () => history.filter((h) => h.kind === 'deposit'),
    [history],
  );

  async function createUser() {
    setBusy(true);
    try {
      const res = await adminFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, balance: Number(form.balance) }),
      });
      const json = await res.json();
      if (json.success) {
        flash('ok', `Created ${form.fullName}`);
        setForm({
          fullName: '',
          phone: '',
          password: '',
          balance: '0',
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

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    try {
      const res = await adminFetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        flash('ok', ok);
        await loadUsers();
        await loadHistory();
      } else flash('err', json.message || 'Update failed');
    } catch {
      flash('err', 'Update failed');
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const res = await adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        flash('ok', 'Deleted');
        await loadUsers();
      } else flash('err', json.message || 'Delete failed');
    } catch {
      flash('err', 'Delete failed');
    }
  }

  async function depositAction(depositId: string, action: 'approve' | 'reject') {
    setBusyId(depositId);
    try {
      const res = await adminFetch('/api/admin/deposits', {
        method: 'POST',
        body: JSON.stringify({ action, depositId }),
      });
      const json = await res.json();
      if (json.success) {
        flash(
          'ok',
          action === 'approve'
            ? `Approved · balance ${json.balance ?? '—'} ETB`
            : 'Deposit rejected',
        );
        await loadHistory();
        await loadUsers();
      } else flash('err', json.message || 'Action failed');
    } catch {
      flash('err', 'Action failed');
    }
    setBusyId(null);
  }

  const cards = [
    {
      label: 'Players',
      value: stats?.users ?? '—',
      icon: Users,
      accent: 'text-equb-300',
    },
    {
      label: 'Admins',
      value: stats?.admins ?? '—',
      icon: Crown,
      accent: 'text-amber-300',
    },
    {
      label: 'Banned',
      value: stats?.banned ?? '—',
      icon: Ban,
      accent: 'text-red-300',
    },
    {
      label: 'Float',
      value: stats
        ? `${Number(stats.totalBalance).toLocaleString()} ETB`
        : '—',
      icon: Wallet,
      accent: 'text-gold-400',
    },
    {
      label: 'Deposits',
      value: stats?.deposits ?? depositRows.length,
      icon: Landmark,
      accent: 'text-sky-300',
    },
    {
      label: 'Pending',
      value: histSummary.depositsPending || stats?.pendingDeposits || '—',
      icon: Clock,
      accent: 'text-orange-300',
    },
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
            {me.name || me.phone} · secured API · auto-refresh 15s
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/system"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-100"
          >
            <KeyRound className="h-3.5 w-3.5" />
            My login
          </Link>
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
      </div>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/[0.04] p-1 text-sm sm:grid-cols-5">
        {(['overview', 'users', 'create', 'deposits', 'history'] as const).map(
          (id) => (
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
          ),
        )}
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
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          {msg.text}
        </p>
      )}

      {tab === 'overview' && (
        <div className="space-y-5">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {cards.map((c) => (
              <article
                key={c.label}
                className="rounded-2xl border border-white/10 bg-black/30 p-4"
              >
                <div className="flex items-center justify-between text-white/40">
                  <p className="text-[11px] uppercase">{c.label}</p>
                  <c.icon className={clsx('h-4 w-4', c.accent)} />
                </div>
                <p className={clsx('mt-3 text-2xl font-bold tabular-nums', c.accent)}>
                  {c.value}
                </p>
              </article>
            ))}
          </section>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTab('create')}
              className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm font-semibold text-amber-100"
            >
              <UserPlus className="h-4 w-4" /> New account
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white/80"
            >
              <History className="h-4 w-4" /> Wallet history
            </button>
            <Link
              href="/admin/deposits"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white/80"
            >
              <Landmark className="h-4 w-4" /> Deposit review
            </Link>
            <Link
              href="/admin/telebirr"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white/80"
            >
              <Landmark className="h-4 w-4" /> Telebirr wallet
            </Link>
            <Link
              href="/admin/audit"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white/80"
            >
              <TrendingUp className="h-4 w-4" /> Audit log
            </Link>
            <button
              type="button"
              onClick={() => setTab('users')}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-white/80"
            >
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
                type={
                  key === 'password'
                    ? 'password'
                    : key === 'balance'
                      ? 'number'
                      : 'text'
                }
                minLength={key === 'password' ? 6 : undefined}
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
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-black disabled:opacity-50"
          >
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
              <li
                key={u.id}
                className="rounded-2xl border border-white/10 bg-black/30 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {displayName(u)}
                      {u.role === 'admin' && (
                        <span className="ml-2 text-[10px] text-amber-400">
                          ADMIN
                        </span>
                      )}
                      {u.banned && (
                        <span className="ml-2 text-[10px] text-red-400">
                          BANNED
                        </span>
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
                  <input
                    placeholder="New phone"
                    value={phoneDraft[u.id] ?? ''}
                    onChange={(e) =>
                      setPhoneDraft((d) => ({ ...d, [u.id]: e.target.value }))
                    }
                    className="w-32 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-sky-500/20 px-2 py-1.5 text-xs text-sky-200"
                    onClick={() =>
                      void patch(
                        u.id,
                        { phone: phoneDraft[u.id] },
                        'Phone updated in DB',
                      )
                    }
                  >
                    Phone
                  </button>
                  <input
                    type="password"
                    placeholder="New password"
                    value={pwDraft[u.id] ?? ''}
                    onChange={(e) =>
                      setPwDraft((d) => ({ ...d, [u.id]: e.target.value }))
                    }
                    className="w-28 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-violet-500/20 px-2 py-1.5 text-xs text-violet-200"
                    onClick={() =>
                      void patch(
                        u.id,
                        { password: pwDraft[u.id] },
                        'Password updated in DB',
                      )
                    }
                  >
                    Password
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-white/10 px-2 py-1.5 text-xs"
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
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-white/50">
              Pending review: {histSummary.depositsPending} · Confirmed volume:{' '}
              {histSummary.depositsVolume.toLocaleString()} ETB
            </p>
            <Link href="/admin/deposits" className="text-xs text-amber-300 underline">
              Full deposit review →
            </Link>
          </div>
          {depositRows.length === 0 && (
            <p className="py-10 text-center text-sm text-white/30">No deposits yet</p>
          )}
          {depositRows.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-mono font-bold text-gold-400">
                  {Number(d.amount).toLocaleString()} ETB
                </p>
                <p className="text-[11px] text-white/45">
                  {d.userName || 'User'} · {d.userPhone || d.userId.slice(0, 8)}
                  {d.transactionNumber ? ` · txn ${d.transactionNumber}` : ''}
                </p>
                <p className="text-[10px] text-white/25">
                  {d.createdAt
                    ? new Date(d.createdAt).toLocaleString()
                    : d.merchantOrderId}
                </p>
                {d.failureReason && (
                  <p className="text-[10px] text-amber-200/70">{d.failureReason}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={clsx(
                    'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase',
                    d.status === 'CONFIRMED' && 'bg-equb-500/20 text-equb-300',
                    canReview(d.status) && 'bg-orange-500/20 text-orange-300',
                    d.status === 'FAILED' && 'bg-red-500/20 text-red-300',
                  )}
                >
                  {d.status}
                </span>
                {canReview(d.status) && (
                  <>
                    <button
                      type="button"
                      disabled={busyId === d.id}
                      onClick={() => void depositAction(d.id, 'approve')}
                      className="rounded-lg bg-equb-500 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === d.id}
                      onClick={() => void depositAction(d.id, 'reject')}
                      className="rounded-lg border border-red-500/40 px-3 py-1.5 text-[11px] font-bold text-red-300 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-3">
          <p className="text-sm text-white/45">
            Combined ledger: deposits, bets, wins, admin balance changes
          </p>
          {history.length === 0 && (
            <p className="py-10 text-center text-sm text-white/30">
              No wallet activity yet
            </p>
          )}
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li
                key={`${h.kind}-${h.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-white/85">
                    {h.kind === 'deposit' ? 'Deposit' : h.reason || 'Ledger'}
                    <span className="ml-2 text-[10px] uppercase text-white/35">
                      {h.status}
                    </span>
                  </p>
                  <p className="text-[11px] text-white/40">
                    {h.userName || 'User'} · {h.userPhone || h.userId.slice(0, 8)}
                    {h.transactionNumber ? ` · ${h.transactionNumber}` : ''}
                  </p>
                  <p className="text-[10px] text-white/25">
                    {h.createdAt
                      ? new Date(h.createdAt).toLocaleString()
                      : ''}
                  </p>
                </div>
                <p
                  className={clsx(
                    'font-mono font-bold tabular-nums',
                    h.delta > 0
                      ? 'text-equb-300'
                      : h.delta < 0
                        ? 'text-red-300'
                        : 'text-gold-400',
                  )}
                >
                  {h.delta > 0 ? '+' : ''}
                  {h.delta !== 0
                    ? h.delta.toLocaleString()
                    : h.amount.toLocaleString()}{' '}
                  ETB
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
