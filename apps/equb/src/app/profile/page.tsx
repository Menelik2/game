'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  ensureAdminAccount,
  loginEmail,
  registerEmail,
} from '@/lib/auth-local';
import { formatBirrCompact } from '@/lib/money';

export default function ProfilePage() {
  const user = useEqubStore((s) => s.user);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const loginDemo = useEqubStore((s) => s.loginDemo);
  const logout = useEqubStore((s) => s.logout);
  const claimReferral = useEqubStore((s) => s.claimReferral);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const { t, locale } = useI18n();

  useEffect(() => {
    void ensureAdminAccount();
  }, []);

  async function handleAuth() {
    setBusy(true);
    setMsg('');
    try {
      if (mode === 'register') {
        const r = await registerEmail({ fullName: name, email, password });
        if (!r.ok) {
          setMsg(r.error);
          return;
        }
        setSessionUser({
          id: r.account.id,
          name: r.account.fullName,
          email: r.account.email || email,
          phone: r.account.phone,
          balance: r.account.balance,
          referralCode: r.account.referralCode,
          role: r.account.role || 'player',
        });
        setMsg('Account created · 5,000 Birr');
      } else {
        const r = await loginEmail({ email, password });
        if (!r.ok) {
          setMsg(r.error);
          return;
        }
        setSessionUser({
          id: r.account.id,
          name: r.account.fullName,
          email: r.account.email || email,
          phone: r.account.phone,
          balance: r.account.balance,
          referralCode: r.account.referralCode,
          role: r.account.role || 'player',
          banned: r.account.banned,
        });
        setMsg(r.account.role === 'admin' ? 'Admin login' : 'Welcome');
      }
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t.profile.title}</h1>
          <LanguageSwitcher />
        </div>

        <div className="glass space-y-4 rounded-3xl p-6">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={
                mode === 'login'
                  ? 'rounded-full bg-equb-500/25 px-4 py-1.5 text-xs font-bold text-equb-300'
                  : 'rounded-full px-4 py-1.5 text-xs text-white/50'
              }
            >
              {t.common.signIn}
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={
                mode === 'register'
                  ? 'rounded-full bg-equb-500/25 px-4 py-1.5 text-xs font-bold text-equb-300'
                  : 'rounded-full px-4 py-1.5 text-xs text-white/50'
              }
            >
              Register
            </button>
          </div>

          {mode === 'register' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.profile.name}
              className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6)"
            className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {msg && <p className="text-xs text-amber-300">{msg}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAuth()}
            className="btn-gold w-full disabled:opacity-50"
          >
            {busy ? '…' : mode === 'login' ? t.common.signIn : 'Create account'}
          </button>

          <div className="border-t border-white/10 pt-4">
            <p className="mb-2 text-xs text-white/40">{t.profile.guestHint}</p>
            <button
              type="button"
              onClick={() => loginDemo(name || undefined)}
              className="w-full rounded-2xl border border-white/15 py-3 text-sm font-semibold text-white/80"
            >
              {t.common.startDemo}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.profile.title}</h1>
        <LanguageSwitcher />
      </div>

      <div className="glass space-y-3 rounded-3xl p-5 text-sm">
        <p>
          <span className="text-white/40">{t.profile.name}</span>
          <br />
          <strong>{user.name}</strong>
          {user.role === 'admin' && (
            <span className="ml-2 rounded-full bg-gold-500/20 px-2 py-0.5 text-[10px] font-bold text-gold-400">
              ADMIN
            </span>
          )}
        </p>
        <p>
          <span className="text-white/40">Email</span>
          <br />
          <strong className="font-mono text-xs">{user.email}</strong>
        </p>
        <p>
          <span className="text-white/40">{t.profile.balance}</span>
          <br />
          <strong className="text-equb-400">
            {formatBirrCompact(user.balance, locale)}
          </strong>
        </p>
        <p>
          <span className="text-white/40">{t.profile.inviteCode}</span>
          <br />
          <strong className="font-mono tracking-widest">{user.referralCode}</strong>
        </p>
      </div>

      {user.role === 'admin' && (
        <Link href="/admin" className="btn-gold block w-full text-center">
          Admin dashboard
        </Link>
      )}

      {!user.referredBy && user.role !== 'admin' && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-semibold">{t.profile.haveCode}</h2>
          <p className="text-xs text-white/40">{t.profile.haveCodeHint}</p>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="flex-1 rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm"
            />
            <button
              type="button"
              className="rounded-xl bg-equb-500/30 px-4 text-sm font-bold text-equb-300"
              onClick={() => setMsg(claimReferral(code).message)}
            >
              {t.profile.apply}
            </button>
          </div>
          {msg && <p className="mt-2 text-xs text-amber-300">{msg}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => logout()}
        className="w-full rounded-2xl border border-white/15 py-3 text-sm text-white/70"
      >
        {t.common.signOut}
      </button>
    </div>
  );
}
