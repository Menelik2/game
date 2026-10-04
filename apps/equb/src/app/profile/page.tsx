'use client';

import { useState } from 'react';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { registerLocal, loginLocal } from '@/lib/auth-local';

type Mode = 'login' | 'register';

export default function ProfilePage() {
  const user = useEqubStore((s) => s.user);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const logout = useEqubStore((s) => s.logout);
  const claimReferral = useEqubStore((s) => s.claimReferral);
  const { t } = useI18n();

  const [mode, setMode] = useState<Mode>('register');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') {
        const res = await registerLocal({ fullName, phone, password });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSessionUser({
          id: res.account.id,
          name: res.account.fullName,
          phone: res.account.phone,
          email: `${res.account.phone.replace('+', '')}@phone.equb`,
          balance: res.account.balance,
          referralCode: res.account.referralCode,
        });
      } else {
        const res = await loginLocal({ phone, password });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setSessionUser({
          id: res.account.id,
          name: res.account.fullName,
          phone: res.account.phone,
          email: `${res.account.phone.replace('+', '')}@phone.equb`,
          balance: res.account.balance,
          referralCode: res.account.referralCode,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t.profile.title}</h1>
          <LanguageSwitcher />
        </div>

        <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
              mode === 'register' ? 'bg-equb-600 text-white' : 'text-white/50'
            }`}
          >
            መመዝገብ · Register
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
              mode === 'login' ? 'bg-equb-600 text-white' : 'text-white/50'
            }`}
          >
            ግባ · Login
          </button>
        </div>

        <form onSubmit={onSubmit} className="glass space-y-4 rounded-3xl p-6">
          <p className="text-sm text-white/50">
            {mode === 'register'
              ? 'ሙሉ ስም፣ ስልክ ቁጥር (የተጠቃሚ ስም) እና የይለፍ ቃል'
              : 'ስልክ ቁጥርዎን (የተጠቃሚ ስም) እና የይለፍ ቃል ያስገቡ'}
          </p>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="mb-1 block text-xs text-white/50">ሙሉ ስም · Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                minLength={2}
                placeholder="ለምሳሌ አበበ ከበደ"
                className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-white/50">
              ስልክ (የተጠቃሚ ስም) · Phone (username)
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
              placeholder="09xxxxxxxx ወይም +2519xxxxxxxx"
              className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-white/50">የይለፍ ቃል · Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="ቢያንስ 6 ቁምፊ"
              className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-gold-500 py-3.5 text-sm font-black text-black disabled:opacity-50"
          >
            {busy
              ? '...'
              : mode === 'register'
                ? 'መመዝገብ · Create account'
                : 'ግባ · Sign in'}
          </button>
        </form>
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
          <span className="text-white/40">ሙሉ ስም · Full name</span>
          <br />
          <strong>{user.name}</strong>
        </p>
        <p>
          <span className="text-white/40">ስልክ (ተጠቃሚ) · Phone</span>
          <br />
          <strong className="font-mono">{user.phone || '—'}</strong>
        </p>
        <p>
          <span className="text-white/40">{t.profile.balance}</span>
          <br />
          <strong className="text-equb-400">
            {user.balance.toLocaleString()} {t.common.birr}
          </strong>
        </p>
        <p>
          <span className="text-white/40">{t.profile.inviteCode}</span>
          <br />
          <strong className="font-mono tracking-widest">{user.referralCode}</strong>
        </p>
      </div>

      {!user.referredBy && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-semibold">{t.profile.haveCode}</h2>
          <p className="text-xs text-white/40">{t.profile.haveCodeHint}</p>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CODE"
              className="flex-1 rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm uppercase"
            />
            <button
              type="button"
              onClick={() => {
                const r = claimReferral(code);
                setMsg(r.message);
              }}
              className="rounded-xl bg-equb-600 px-4 text-sm font-semibold"
            >
              {t.profile.apply}
            </button>
          </div>
          {msg && <p className="mt-2 text-xs text-equb-300">{msg}</p>}
        </div>
      )}

      <button
        type="button"
        onClick={() => logout()}
        className="w-full rounded-xl border border-white/10 py-3 text-sm text-white/50"
      >
        {t.common.signOut}
      </button>
    </div>
  );
}
