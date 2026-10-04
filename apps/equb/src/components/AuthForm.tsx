'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEqubStore } from '@/lib/store';
import {
  apiLogin,
  apiRegister,
  apiWalletBalance,
  isApiConfigured,
} from '@/lib/api';
import { registerLocal, loginLocal } from '@/lib/auth-local';

type Mode = 'login' | 'register';

function mapErr(msg: string): string {
  if (msg === 'API_NOT_CONFIGURED') {
    return 'ሰርቨር አልተገናኘም — በአካባቢ መለያ እንሞክራለን';
  }
  if (msg === 'NETWORK_ERROR') {
    return 'ከሰርቨር ጋር መገናኘት አልተቻለም — በአካባቢ መለያ እንሞክራለን';
  }
  return msg;
}

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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');

  const applySession = (opts: {
    id: string;
    name: string;
    phone?: string;
    email: string;
    balance: number;
    referralCode: string;
  }) => {
    setSessionUser(opts);
    router.push(redirectTo);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setHint('');
    setBusy(true);

    try {
      // —— 1) Try real API (Postgres) when configured ——
      if (isApiConfigured()) {
        try {
          const result =
            mode === 'register'
              ? await apiRegister({ fullName, phone, password })
              : await apiLogin({ phone, password });

          const u = result.user;
          const token = result.accessToken;
          if (token) localStorage.setItem('equb_access_token', token);

          let balance = 5000;
          const remoteBal = token ? await apiWalletBalance(token) : null;
          if (remoteBal != null) balance = remoteBal;

          applySession({
            id: u.id,
            name: u.fullName || fullName.trim() || u.phone || phone || 'ተጠቃሚ',
            phone: u.phone || phone,
            email: u.email,
            balance,
            referralCode:
              (u.phone || phone || 'EQ').replace(/\D/g, '').slice(-6).toUpperCase() ||
              'EQUB01',
          });
          return;
        } catch (apiErr) {
          const raw = apiErr instanceof Error ? apiErr.message : 'API error';
          // Hard validation errors from server — show, do not silently local-fallback
          if (
            /already exists|PHONE_EXISTS|EMAIL_EXISTS|Invalid phone|password|Validation|required|locked/i.test(
              raw,
            ) &&
            raw !== 'API_NOT_CONFIGURED' &&
            raw !== 'NETWORK_ERROR'
          ) {
            setError(raw);
            return;
          }
          setHint(mapErr(raw));
          // fall through to local
        }
      }

      // —— 2) Local device account (always works offline) ——
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
        });
      } else {
        const res = await loginLocal({ phone, password });
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
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError('');
            setHint('');
          }}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
            mode === 'login' ? 'bg-equb-600 text-white shadow' : 'text-white/45 hover:text-white/70'
          }`}
        >
          ግባ
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError('');
            setHint('');
          }}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
            mode === 'register' ? 'bg-equb-600 text-white shadow' : 'text-white/45 hover:text-white/70'
          }`}
        >
          መመዝገብ
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <p className="text-xs text-white/45">
          {mode === 'register'
            ? 'ሙሉ ስም · ስልክ (ተጠቃሚ) · የይለፍ ቃል'
            : 'ስልክ ቁጥርዎን እና የይለፍ ቃል ያስገቡ'}
        </p>

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

        {mode === 'register' && (
          <div>
            <label className="mb-1 block text-[11px] font-medium text-white/50">ሙሉ ስም</label>
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
          <label className="mb-1 block text-[11px] font-medium text-white/50">የይለፍ ቃል</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            placeholder="ቢያንስ 6 ቁምፊ"
            className="w-full rounded-xl border border-white/10 bg-surface-800/80 px-3.5 py-3 text-sm outline-none ring-equb-500/40 placeholder:text-white/25 focus:ring-2"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="btn-gold w-full py-3.5 text-sm disabled:opacity-50"
        >
          {busy ? '...' : mode === 'register' ? 'መለያ ፍጠር' : 'ግባ'}
        </button>
      </form>
    </div>
  );
}
