'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';

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
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, balance: Number(form.balance) }) });
    const json = await res.json();
    setMsg(json.success ? 'User created' : json.message || 'Create failed');
    if (json.success) { setForm({ fullName: '', phone: '', password: '123456', balance: '100', role: 'player' }); await load(); setTab('users'); }
  }

  async function patch(id: string, body: Record<string, unknown>, ok: string) {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    setMsg(json.success ? ok : json.message || 'Update failed');
    if (json.success) await load();
  }

  async function remove(id: string) {
    if (!confirm('Delete this user?')) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    const json = await res.json();
    setMsg(json.success ? 'User deleted' : json.message || 'Delete failed');
    if (json.success) await load();
  }

  if (!me) return <p className="py-10 text-center text-white/50">Sign in as admin</p>;
  if (!isAdmin(me)) return <p className="py-10 text-center text-white/50">Admin only</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Admin</h1>
        <div className="flex gap-2 text-xs">
          <Link href="/admin/deposits" className="rounded-lg border border-white/10 px-3 py-1.5">Deposits</Link>
          <Link href="/admin/audit" className="rounded-lg border border-white/10 px-3 py-1.5">Audit</Link>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/5 p-1 text-sm">
        {(['overview', 'users', 'create'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={tab === t ? 'rounded-xl bg-amber-400 py-2 font-black text-black' : 'py-2 text-white/70'}>{t}</button>
        ))}
      </div>
      {msg && <p className="rounded-xl bg-white/5 px-3 py-2 text-sm text-amber-200">{msg}</p>}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            ['Users', stats?.users ?? '—'],
            ['Admins', stats?.admins ?? '—'],
            ['Banned', stats?.banned ?? '—'],
            ['Balances', stats ? `${stats.totalBalance.toFixed(0)} ETB` : '—'],
            ['Deposits', stats?.deposits ?? '—'],
            ['Pending pay', stats?.pendingDeposits ?? '—'],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase text-white/40">{k}</p>
              <p className="text-xl font-black">{v}</p>
            </div>
          ))}
        </div>
      )}
      {tab === 'create' && (
        <div className="space-y-2 rounded-2xl border border-white/10 p-4">
          <input placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full rounded-xl bg-black/40 px-3 py-2" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-xl bg-black/40 px-3 py-2" />
          <input placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-xl bg-black/40 px-3 py-2" />
          <input placeholder="Start balance" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} className="w-full rounded-xl bg-black/40 px-3 py-2" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-xl bg-black/40 px-3 py-2">
            <option value="player">player</option>
            <option value="admin">admin</option>
          </select>
          <button type="button" onClick={() => void createUser()} className="w-full rounded-xl bg-amber-400 py-3 font-black text-black">Create user</button>
        </div>
      )}
      {tab === 'users' && (
        <div className="space-y-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" className="w-full rounded-xl bg-black/40 px-3 py-2" />
          {filtered.map((u) => (
            <div key={u.id} className="rounded-2xl border border-white/10 p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{u.fullName || u.name || 'User'}</p>
                  <p className="text-xs text-white/40">{u.phone} · {u.role || 'player'} {u.banned ? '· BANNED' : ''}</p>
                </div>
                <p className="font-black text-amber-300">{Number(u.balance || 0).toFixed(0)} ETB</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <button type="button" className="rounded-lg bg-white/10 px-2 py-1" onClick={() => void patch(u.id, { balance: Number(u.balance) + 100 }, '+100 ETB')}>+100</button>
                <button type="button" className="rounded-lg bg-white/10 px-2 py-1" onClick={() => void patch(u.id, { balance: Number(u.balance) + 500 }, '+500 ETB')}>+500</button>
                <button type="button" className="rounded-lg bg-white/10 px-2 py-1" onClick={() => { const n = Number(prompt('Set balance', String(u.balance))); if (Number.isFinite(n) && n >= 0) void patch(u.id, { balance: n }, 'Balance set'); }}>Set</button>
                <button type="button" className="rounded-lg bg-white/10 px-2 py-1" onClick={() => void patch(u.id, { banned: !u.banned }, u.banned ? 'Unbanned' : 'Banned')}>{u.banned ? 'Unban' : 'Ban'}</button>
                <button type="button" className="rounded-lg bg-white/10 px-2 py-1" onClick={() => void patch(u.id, { role: u.role === 'admin' ? 'player' : 'admin' }, 'Role updated')}>{u.role === 'admin' ? 'Make player' : 'Make admin'}</button>
                <button type="button" className="rounded-lg bg-red-500/20 px-2 py-1 text-red-200" onClick={() => void remove(u.id)}>Delete</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-white/40">No users</p>}
        </div>
      )}
    </div>
  );
}
