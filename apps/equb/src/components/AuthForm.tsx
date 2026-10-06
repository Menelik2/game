'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEqubStore, type User } from '@/lib/store';
import { apiLogin, apiRegister, apiForgotPassword } from '@/lib/auth-api';
import { registerLocal, loginLocal, resetPasswordLocal } from '@/lib/auth-local';

type Mode = 'login' | 'register' | 'forgot';

export function AuthForm({
  initialMode = 'login',
  redirectTo = '/rooms',
}: {
  initialMode?: Mode;
  redirectTo?: string;
  compact?: boolean;
}) {
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  const applySession = (user: User) => {
    setSessionUser(user);
    if (user.role === 'admin') {
      router.push('/admin');
      return;
    }
    router.push(redirectTo);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setHint('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setHint('');
    setSuccess('');
    setBusy(true);

    try {
      // —— Forgot password ——
      if (mode === 'forgot') {
        if (password !== confirmPassword) {
          setError('የይለፍ ቃሎች አይዛመዱም / Passwords do not match');
          return;
        }
        if (password.length < 6) {
          setError('አዲስ የይለፍ ቃል ቢያንስ 6 ቁምፊ');
          return;
        }

        try {
          const api = await apiForgotPassword({
            phone,
            fullName,
            newPassword: password,
          });
          if (api.ok) {
            setSuccess(
              'የይለፍ ቃል ተቀይሯል — አሁን ይግቡ / Password updated — log in now',
            );
            setMode('login');
            setPassword('');
            setConfirmPassword('');
            return;
          }
          setHint(api.error);
        } catch {
          setHint('Server unreachable — trying local');
        }

        const local = await resetPasswordLocal({
          phone,
          fullName,
          newPassword: password,
        });
        if (!local.ok) {
          setError(local.error || hint || 'Reset failed');
          return;
        }
        setSuccess(
          'የይለፍ ቃል ተቀይሯል — አሁን ይግቡ / Password updated — log in now',
        );
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        return;
      }

      // —— Register / Login ——
      try {
        if (mode === 'register') {
          const result = await apiRegister({ fullName, phone, password });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          const u = result.user;
          applySession({
            id: u.id,
            name: u.fullName || fullName.trim() || 'ተጠቃሚ',
            phone: u.phone || phone,
            email: `${(u.phone || phone).replace('+', '')}@phone.equb`,
            balance: Number(u.balance) || 100,
            referralCode: u.referralCode || 'EQUB01',
            role: (u.role as 'player' | 'admin') || 'player',
            banned: u.banned,
          });
          return;
        }

        const result = await apiLogin({ phone, password });
        if (result.ok) {
          const u = result.user;
          applySession({
            id: u.id,
            name: u.fullName || 'ተጠቃሚ',
            phone: u.phone || phone,
            email: `${(u.phone || phone).replace('+', '')}@phone.equb`,
            balance: Number(u.balance) || 0,
            referralCode: u.referralCode || 'EQUB01',
            role: (u.role as 'player' | 'admin') || 'player',
            banned: u.banned,
          });
          return;
        }
        setHint(result.error);
      } catch {
        setHint('Server unreachable — trying local account');
      }

      if (mode === 'register') {
        const res = await registerLocal({ fullName, phone, password });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        applySession({
          id: res.account.id,
          name: res.account.fullName,
          phone: res.account.phone,
          email: `${res.account.phone.replace('+', '')}@phone.equb`,
          balance: res.account.balance,
          referralCode: res.account.referralCode,
          role: res.account.role || 'player',
          banned: res.account.banned,
        });
      } else {
        const res = await loginLocal({ phone, password });
        if (!res.ok) {
          setError(res.error || hint || 'Login failed');
          return;
        }
        applySession({
          id: res.account.id,
          name: res.account.fullName,
          phone: res.account.phone,
          email: `${res.account.phone.replace('+', '')}@phone.equb`,
          balance: res.account.balance,
          referralCode: res.account.referralCode,
          role: res.account.role || 'player',
          banned: res.account.banned,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ስህተት ተፈጥሯል');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {mode !== 'forgot' && (
        <div className="flex gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              mode === 'login'
                ? 'bg-equb-600 text-white shadow'
                : 'text-white/45 hover:text-white/70'
            }`}
          >
            ግባ
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
              mode === 'register'
                ? 'bg-equb-600 text-white shadow'
                : 'text-white/45 hover:text-white/70'
            }`}
          >
            መመዝገብ
          </button>
        </div>
      )}

      {mode === 'forgot' && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">የይለፍ ቃል መርሳት</h3>
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="text-xs font-semibold text-equb-300 hover:underline"
          >
            ← ወደ ግባ
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-xs text-white/45">
          {mode === 'register'
            ? 'ሙሉ ስም · ስልክ (ተጠቃሚ) · የይለፍ ቃል'
            : mode === 'forgot'
              ? 'ስልክ · ሙሉ ስም (ማረጋገጫ) · አዲስ የይለፍ ቃል'
              : 'ስልክ ቁጥርዎን እና የይለፍ ቃል ያስገቡ'}
        </p>

        {success && (
          <div className="rounded-xl border border-equb-500/30 bg-equb-500/10 px-3 py-2 text-xs text-equb-200">
            {success}
          </div>
        )}

        {hint && !error && (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
            {hint}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {(mode === 'register' || mode === 'forgot') && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/50">
              ሙሉ ስም
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              minLength={2}
              autoComplete="name"
              placeholder="አበበ ከበደ"
              className="w-full rounded-xl border border-white/10 bg-surface-800/80 px-3.5 py-3 text-sm outline-none ring-equb-500/40 placeholder:text-white/25 focus:ring-2"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-[11px] font-medium text-white/50">
            ስልክ ቁጥር (የተጠቃሚ ስም)
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="09xxxxxxxx"
            className="w-full rounded-xl border border-white/10 bg-surface-800/80 px-3.5 py-3 text-sm outline-none ring-equb-500/40 placeholder:text-white/25 focus:ring-2"
          />
        </div>

        <div>
          <label className="mb-1 block text-[11px] font-medium text-white/50">
            {mode === 'forgot' ? 'አዲስ የይለፍ ቃል' : 'የይለፍ ቃል'}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={
              mode === 'register' || mode === 'forgot'
                ? 'new-password'
                : 'current-password'
            }
            placeholder="ቢያንስ 6 ቁምፊ"
            className="w-full rounded-xl border border-white/10 bg-surface-800/80 px-3.5 py-3 text-sm outline-none ring-equb-500/40 placeholder:text-white/25 focus:ring-2"
          />
        </div>

        {mode === 'forgot' && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/50">
              አዲስ የይለፍ ቃል አረጋግጥ
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="እንደገና ያስገቡ"
              className="w-full rounded-xl border border-white/10 bg-surface-800/80 px-3.5 py-3 text-sm outline-none ring-equb-500/40 placeholder:text-white/25 focus:ring-2"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="btn-gold w-full py-3.5 text-sm disabled:opacity-50"
        >
          {busy
            ? '...'
            : mode === 'register'
              ? 'መለያ ፍጠር'
              : mode === 'forgot'
                ? 'የይለፍ ቃል ቀይር'
                : 'ግባ'}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            onClick={() => switchMode('forgot')}
            className="w-full text-center text-xs font-semibold text-white/50 hover:text-equb-300"
          >
            የይለፍ ቃል ረሱ? · Forgot password?
          </button>
        )}
      </form>
    </div>
  );
}
