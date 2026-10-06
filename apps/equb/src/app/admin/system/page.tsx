'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { fetchAdminHealth } from '@/lib/admin-api';
import { isApiConfigured, getApiBase } from '@/lib/api';
import { AlertCircle, Server, Database, Shield, KeyRound, Save } from 'lucide-react';

export default function AdminSystemPage() {
  const user = useEqubStore((s) => s.user);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const [health, setHealth] = useState<{
    ok: boolean;
    database: string;
    demoMode: boolean;
    realMoneyEnabled: boolean;
    nodeEnv: string;
    timestamp: string;
  } | null>(null);
  const [error, setError] = useState('');

  // Change own credentials
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
    if (user?.name) setFullName(user.name);
  }, [user?.phone, user?.name]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        if (isApiConfigured()) {
          const h = await fetchAdminHealth();
          if (!c) setHealth(h);
        }
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : 'Health check failed');
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  async function saveCredentials(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    if (!user?.id) {
      setFormMsg({ type: 'err', text: 'Not signed in' });
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setFormMsg({ type: 'err', text: 'New passwords do not match' });
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setFormMsg({ type: 'err', text: 'New password min 6 characters' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          phone: phone.trim() || undefined,
          fullName: fullName.trim() || undefined,
          password: newPassword || undefined,
          currentPassword: currentPassword || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setFormMsg({ type: 'err', text: json.message || 'Update failed' });
        setSaving(false);
        return;
      }

      const d = json.data;
      setSessionUser({
        ...user,
        id: d.id || user.id,
        name: d.fullName || fullName || user.name,
        phone: d.phone || phone || user.phone,
        email: `${String(d.phone || phone || '').replace('+', '')}@phone.equb`,
        balance: typeof d.balance === 'number' ? d.balance : user.balance,
        role: (d.role as 'admin' | 'player') || user.role,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFormMsg({
        type: 'ok',
        text: 'Saved to database. Use the new phone/password next login.',
      });
    } catch (err) {
      setFormMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Network error',
      });
    }
    setSaving(false);
  }

  if (!user) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-400" />
        <Link href="/profile" className="mt-3 inline-block text-equb-400 underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-white/50">Infrastructure & admin login</p>

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {error}
        </div>
      )}

      {/* Change admin credentials */}
      <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-amber-300" />
          <h2 className="text-sm font-bold text-amber-100">Change admin login</h2>
        </div>
        <p className="mb-4 text-xs text-white/45">
          Updates your phone (username) and password in the database. Next login uses the new values.
        </p>

        <form onSubmit={saveCredentials} className="mx-auto max-w-md space-y-3">
          <label className="block text-xs text-white/50">
            Full name
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-amber-500/40"
              placeholder="Admin name"
            />
          </label>

          <label className="block text-xs text-white/50">
            Phone (login username)
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-amber-500/40"
              placeholder="09xxxxxxxx"
            />
          </label>

          <label className="block text-xs text-white/50">
            Current password (optional, recommended)
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-amber-500/40"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          <label className="block text-xs text-white/50">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-amber-500/40"
              placeholder="Leave blank to keep current"
              autoComplete="new-password"
              minLength={6}
            />
          </label>

          <label className="block text-xs text-white/50">
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm outline-none focus:border-amber-500/40"
              placeholder="Repeat new password"
              autoComplete="new-password"
            />
          </label>

          {formMsg && (
            <p
              className={`rounded-xl border px-3 py-2 text-xs ${
                formMsg.type === 'ok'
                  ? 'border-equb-500/30 bg-equb-500/10 text-equb-200'
                  : 'border-red-500/30 bg-red-500/10 text-red-200'
              }`}
            >
              {formMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 text-sm font-bold text-black disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save to database'}
          </button>
        </form>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-white/40">
            <Server className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase">API base</span>
          </div>
          <p className="mt-2 break-all font-mono text-sm text-equb-200">
            {getApiBase() || '(same origin)'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-white/40">
            <Database className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase">Database</span>
          </div>
          <p className="mt-2 text-lg font-bold">
            {health ? (
              <span className={health.ok ? 'text-equb-300' : 'text-red-300'}>
                {health.database}
              </span>
            ) : (
              <span className="text-white/30">…</span>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-white/40">
            <Shield className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase">Flags</span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            <li>ENV: {health?.nodeEnv || '—'}</li>
            <li>Demo mode: {health ? String(health.demoMode) : '—'}</li>
            <li>
              Real money:{' '}
              {health ? String(health.realMoneyEnabled) : '—'}
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-semibold uppercase text-white/40">Checked at</div>
          <p className="mt-2 text-sm text-white/60">
            {health?.timestamp
              ? new Date(health.timestamp).toLocaleString()
              : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
