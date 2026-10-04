'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEqubStore } from '@/lib/store';
import { apiLogin, apiRegister, apiWalletBalance, isApiConfigured } from '@/lib/api';

type Mode = 'login' | 'register';

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isApiConfigured()) {
      setError(
        'ሰርቨር አልተገናኘም። በ Vercel ላይ NEXT_PUBLIC_API_URL = የ API አድራሻዎን ያስገቡ (ለምሳሌ https://your-api.onrender.com)',
      );
      return;
    }

    setBusy(true);
    try {
      const result =
        mode === 'register'
          ? await apiRegister({ fullName, phone, password })
          : await apiLogin({ phone, password });

      const u = result.user;
      const token = result.accessToken;
      if (typeof window !== 'undefined' && token) {
        localStorage.setItem('equb_access_token', token);
      }

      let balance = 5000;
      const remoteBal = token ? await apiWalletBalance(token) : null;
      if (remoteBal != null) balance = remoteBal;

      const displayName =
        u.fullName ||
        fullName.trim() ||
        u.phone ||
        phone ||
        'ተጠቃሚ';

      setSessionUser({
        id: u.id,
        name: displayName,
        phone: u.phone || phone,
        email: u.email,
        balance,
        referralCode:
          (u.phone || phone || 'EQ').replace(/\D/g, '').slice(-6).toUpperCase() ||
          'EQUB01',
      });

      router.push(redirectTo);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'ስህተት ተፈጥሯል — እንደገና ይሞክሩ';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {!isApiConfigured() && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          መለያዎች በዳታቤዝ እንዲቀመጡ API ያስፈልጋል። NEXT_PUBLIC_API_URL ያዘጋጁ።
        </div>
      )}

      <div className="flex gap-1 rounded-2xl border border-white/10 bg-black/30 p-1">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError('');
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
            ? 'ሙሉ ስም · ስልክ (ተጠቃሚ) · የይለፍ ቃል — በዳታቤዝ ይቀመጣል'
            : 'ስልክ ቁጥርዎን እና የይለፍ ቃል ያስገቡ'}
        </p>

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
          {busy ? '...' : mode === 'register' ? 'መለያ ፍጠር (ዳታቤዝ)' : 'ግባ'}
        </button>
      </form>
    </div>
  );
}
