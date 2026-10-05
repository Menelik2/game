'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import {
  ensureAdminAccount,
  loginLocal,
  registerLocal,
} from '@/lib/auth-local';
import { apiLogin, apiRegister } from '@/lib/auth-api';
import { formatBirrCompact } from '@/lib/money';

function sessionIsAdmin(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  return (user as { role?: string }).role === 'admin';
}

export default function ProfilePage() {
  const user = useEqubStore((s) => s.user);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const loginDemo = useEqubStore((s) => s.loginDemo);
  const logout = useEqubStore((s) => s.logout);
  const claimReferral = useEqubStore((s) => s.claimReferral);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
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
        const db = await apiRegister({ fullName, phone, password });
        if (db.ok) {
          setSessionUser({
            id: db.user.id,
            name: db.user.fullName,
            email: `${db.user.phone}@phone.equb`,
            phone: db.user.phone,
            balance: db.user.balance,
            referralCode: db.user.referralCode,
            role: (db.user.role as 'player' | 'admin') || 'player',
          });
          setMsg(
            locale === 'am'
              ? 'ተመዝግበዋል (DB) · 5,000 ብር'
              : 'Registered in database · 5,000 Birr',
          );
          return;
        }
        if (!db.fallbackLocal) {
          setMsg(db.error);
          return;
        }
        const r = await registerLocal({ fullName, phone, password });
        if (!r.ok) {
          setMsg(r.error);
          return;
        }
        setSessionUser({
          id: r.account.id,
          name: r.account.fullName,
          email: r.account.email || `${r.account.phone}@phone.equb`,
          phone: r.account.phone,
          balance: r.account.balance,
          referralCode: r.account.referralCode,
          role: r.account.role || 'player',
        });
        setMsg(
          locale === 'am'
            ? 'ተመዝግበዋል (local) · 5,000 ብር'
            : 'Registered locally · 5,000 Birr',
        );
      } else {
        const db = await apiLogin({ phone, password });
        if (db.ok) {
          setSessionUser({
            id: db.user.id,
            name: db.user.fullName,
            email: `${db.user.phone}@phone.equb`,
            phone: db.user.phone,
            balance: db.user.balance,
            referralCode: db.user.referralCode,
            role: (db.user.role as 'player' | 'admin') || 'player',
            banned: db.user.banned,
          });
          setMsg(
            db.user.role === 'admin'
              ? locale === 'am'
                ? 'አስተዳዳሪ (DB)'
                : 'Admin (database)'
              : locale === 'am'
                ? 'እንኳን ደህና መጡ'
                : 'Welcome',
          );
          return;
        }
        if (!db.fallbackLocal) {
          setMsg(db.error);
          return;
        }
        const r = await loginLocal({ phone, password });
        if (!r.ok) {
          setMsg(r.error);
          return;
        }
        setSessionUser({
          id: r.account.id,
          name: r.account.fullName,
          email: r.account.email || `${r.account.phone}@phone.equb`,
          phone: r.account.phone,
          balance: r.account.balance,
          referralCode: r.account.referralCode,
          role: r.account.role || 'player',
          banned: r.account.banned,
        });
        setMsg(
          r.account.role === 'admin'
            ? 'Admin (local)'
            : locale === 'am'
              ? 'እንኳን ደህና መጡ'
              : 'Welcome',
        );
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
              {locale === 'am' ? 'ግባ' : t.common.signIn}
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
              {locale === 'am' ? 'ተመዝገብ' : 'Register'}
            </button>
          </div>
          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-[10px] uppercase text-white/40">
                {locale === 'am' ? 'ሙሉ ስም' : 'Full name'}
              </label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={locale === 'am' ? 'አበበ ከበደ' : 'Full name'}
                className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-[10px] uppercase text-white/40">
              {locale === 'am' ? 'ስልክ' : 'Phone'}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
              className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] uppercase text-white/40">
              {locale === 'am' ? 'የይለፍ ቃል' : 'Password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6"
              className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
            />
          </div>
          {msg && <p className="text-xs text-amber-300">{msg}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAuth()}
            className="btn-gold w-full disabled:opacity-50"
          >
            {busy ? '…' : mode === 'login' ? (locale === 'am' ? 'ግባ' : 'Sign in') : locale === 'am' ? 'መለያ ፍጠር' : 'Create account'}
          </button>
          <div className="border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={() => loginDemo(fullName || undefined)}
              className="w-full rounded-2xl border border-white/15 py-3 text-sm text-white/80"
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
          <span className="text-white/40">{locale === 'am' ? 'ሙሉ ስም' : 'Full name'}</span>
          <br />
          <strong>{user.name}</strong>
          {sessionIsAdmin(user) && (
            <span className="ml-2 rounded-full bg-gold-500/20 px-2 py-0.5 text-[10px] font-bold text-gold-400">ADMIN</span>
          )}
        </p>
        <p>
          <span className="text-white/40">{locale === 'am' ? 'ስልክ' : 'Phone'}</span>
          <br />
          <strong className="font-mono text-xs">{user.phone || user.email}</strong>
        </p>
        <p>
          <span className="text-white/40">{t.profile.balance}</span>
          <br />
          <strong className="text-equb-400">{formatBirrCompact(user.balance, locale)}</strong>
        </p>
        <p>
          <span className="text-white/40">{t.profile.inviteCode}</span>
          <br />
          <strong className="font-mono tracking-widest">{user.referralCode}</strong>
        </p>
      </div>
      {sessionIsAdmin(user) && (
        <Link href="/admin" className="btn-gold block w-full text-center">Admin dashboard</Link>
      )}
      {!user.referredBy && !sessionIsAdmin(user) && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-semibold">{t.profile.haveCode}</h2>
          <div className="mt-3 flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} className="flex-1 rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm" />
            <button type="button" className="rounded-xl bg-equb-500/30 px-4 text-sm font-bold text-equb-300" onClick={() => setMsg(claimReferral(code).message)}>{t.profile.apply}</button>
          </div>
          {msg && <p className="mt-2 text-xs text-amber-300">{msg}</p>}
        </div>
      )}
      <button type="button" onClick={() => logout()} className="w-full rounded-2xl border border-white/15 py-3 text-sm text-white/70">{t.common.signOut}</button>
    </div>
  );
}
