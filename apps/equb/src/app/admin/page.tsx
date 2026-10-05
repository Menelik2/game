'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { Shield, Users, Ban, Wallet, Landmark, Clock, Search, Plus } from 'lucide-react';

type U = { id: string; fullName?: string; name?: string; phone: string; balance: number; role?: string; banned?: boolean };
type Stats = { users: number; admins: number; banned: number; totalBalance: number; deposits: number; pendingDeposits: number };

function isAdmin(user: unknown) {
  return !!user && typeof user === 'object' && (user as { role?: string }).role === 'admin';
}

export default function AdminPage() {
  const router = useRouter();
  const me = useEqubStore((s) => s.user);
  const [tab, setTab] = useState<'overview' | 'users' | 'create'>('overview');
  const [users, setUsers] = useState<U[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', password: '123456', balance: '100', role: 'player' });

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/users');
    const json = await res.json();
    if (json?.success) {
      setUsers(json.data.users || []);
      setStats(json.data.stats);
    } else setMsg(json?.message || 'Could not load users');
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (me && !isAdmin(me)) router.replace('/'); }, [me, router]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter((u) => `${u.fullName || u.name || ''} ${u.phone} ${u.role}`.toLowerCase().includes(s));
  }, [users, q]);

  async function createUser() {
    setBusy(true);
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, balance: Number(form.balance) }) });
    const json = await res.json();
    setMsg(json.success ? 'Account created' : json.message || 'Create failed');
    if (json.success) {
      setForm({ fullName: '', phone: '', password: '123456', balance: '100', role: 'player' });
      await load();
      setTab('users');
    }
    setBusy(false);
  }

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    setMsg(json.success ? ok : json.message || 'Update failed');
    if (json.success) await load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this account? This cannot be undone.')) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setMsg(json.success ? 'Account deleted' : json.message || 'Delete failed');
    if (json.success) await load();
  }

  if (!me) return <p className="py-16 text-center text-sm text-white/50">Sign in as admin</p>;
  if (!isAdmin(me)) return <p className="py-16 text-center text-sm text-white/50">Admin only</p>;

  const cards = [
    { label: 'Players', value: stats?.users ?? '—', icon: Users },
    { label: 'Admins', value: stats?.admins ?? '—', icon: Shield },
    { label: 'Banned', value: stats?.banned ?? '—', icon: Ban },
    { label: 'Float', value: stats ? `${stats.totalBalance.toLocaleString()} ETB` : '—', icon: Wallet },
    { label: 'Deposits', value: stats?.deposits ?? '—', icon: Landmark },
    { label: 'Pending', value: stats?.pendingDeposits ?? '—', icon: Clock },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/80">Control room</p>
          <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
          <p className="text-sm text-white/45">Accounts, balances, and payment review</p>
        </div>
        <nav className="flex gap-2 text-xs">
          <Link href="/admin/deposits" className="rounded-full border border-white/10 px-3 py-1.5 text-white/70">Deposits</Link>
          <Link href="/admin/audit" className="rounded-full border border-white/10 px-3 py-1.5 text-white/70">Audit</Link>
        </nav>
      </header>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/[0.04] p-1 text-sm">
        {([
          ['overview', 'Overview'],
          ['users', 'Accounts'],
          ['create', 'New account'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? 'rounded-xl bg-amber-400 py-2.5 font-semibold text-black' : 'py-2.5 text-white/60'}>{label}</button>
        ))}
      </div>
      {msg && <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">{msg}</p>}
      {tab === 'overview' && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {cards.map((c) => (
            <article key={c.label} className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-transparent p-4">
              <div className="flex items-center justify-between text-white/40">
                <p className="text-[11px] uppercase tracking-wide">{c.label}</p>
                <c.icon className="h-4 w-4" />
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">{c.value}</p>
            </article>
          ))}
        </section>
      )}
      {tab === 'create' && (
        <form className="mx-auto max-w-md space-y-3 rounded-2xl border border-white/10 p-5" onSubmit={(e) => { e.preventDefault(); void createUser(); }}>
          <h2 className="text-lg font-semibold">Create account</h2>
          <label className="block text-xs text-white/50">Full name<input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" /></label>
          <label className="block text-xs text-white/50">Phone<input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" /></label>
          <label className="block text-xs text-white/50">Password<input required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" /></label>
          <label className="block text-xs text-white/50">Opening balance (ETB)<input value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm" /></label>
          <label className="block text-xs text-white/50">Role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm"><option value="player">Player</option><option value="admin">Admin</option></select></label>
          <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-semibold text-black disabled:opacity-50"><Plus className="h-4 w-4" /> {busy ? 'Saving…' : 'Create account'}</button>
        </form>
      )}
      {tab === 'users' && (
        <section className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-3 text-sm" />
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            {filtered.map((u) => (
              <div key={u.id} className="border-b border-white/5 px-4 py-3 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{u.fullName || u.name || 'User'}</p>
                    <p className="text-xs text-white/40">{u.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums text-amber-200">{Number(u.balance || 0).toLocaleString()} ETB</p>
                    <p className="text-[10px] uppercase tracking-wide text-white/35">{u.role || 'player'}{u.banned ? ' · banned' : ''}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button type="button" className="rounded-full bg-white/10 px-3 py-1 text-xs" onClick={() => void patch(u.id, { balance: Number(u.balance) + 100 }, '+100 ETB')}>+100</button>
                  <button type="button" className="rounded-full bg-white/10 px-3 py-1 text-xs" onClick={() => void patch(u.id, { balance: Number(u.balance) + 500 }, '+500 ETB')}>+500</button>
                  <button type="button" className="rounded-full bg-white/10 px-3 py-1 text-xs" onClick={() => { const n = Number(prompt('Set balance (ETB)', String(u.balance))); if (Number.isFinite(n) && n >= 0) void patch(u.id, { balance: n }, 'Balance updated'); }}>Set balance</button>
                  <button type="button" className="rounded-full bg-white/10 px-3 py-1 text-xs" onClick={() => void patch(u.id, { banned: !u.banned }, u.banned ? 'Unbanned' : 'Banned')}>{u.banned ? 'Unban' : 'Ban'}</button>
                  <button type="button" className="rounded-full bg-white/10 px-3 py-1 text-xs" onClick={() => void patch(u.id, { role: u.role === 'admin' ? 'player' : 'admin' }, 'Role updated')}>{u.role === 'admin' ? 'Make player' : 'Make admin'}</button>
                  <button type="button" className="rounded-full bg-red-500/15 px-3 py-1 text-xs text-red-200" onClick={() => void remove(u.id)}>Delete</button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="px-4 py-10 text-center text-sm text-white/40">No accounts match.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
