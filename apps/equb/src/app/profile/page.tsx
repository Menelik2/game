'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AuthForm } from '@/components/AuthForm';
import { formatBirrCompact } from '@/lib/money';
import { User, Phone, Wallet, Gift, LogOut, ArrowRight } from 'lucide-react';

export default function ProfilePage() {
  const user = useEqubStore((s) => s.user);
  const logout = useEqubStore((s) => s.logout);
  const claimReferral = useEqubStore((s) => s.claimReferral);
  const { t, locale } = useI18n();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  if (!user) {
    return (
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t.profile.title}</h1>
            <p className="mt-1 text-sm text-white/45">ግባ ወይም አዲስ መለያ ይፍጠሩ</p>
          </div>
          <LanguageSwitcher />
        </div>

        <div className="glass rounded-3xl border border-equb-800/40 p-5 sm:p-6">
          <AuthForm initialMode="login" redirectTo="/rooms" />
        </div>

        <p className="text-center text-[11px] text-white/30">
          ስልክ ቁጥርዎ የተጠቃሚ ስምዎ ነው · Phone is your username
        </p>
      </div>
    );
  }

  const initial = (user.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t.profile.title}</h1>
        <LanguageSwitcher />
      </div>

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-3xl border border-equb-700/40 bg-gradient-to-br from-equb-950/90 to-[#0a1210] p-5">
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-equb-500/20 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-equb-400 to-equb-700 text-2xl font-black text-black shadow-lg shadow-equb-500/20">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-white">{user.name}</p>
            <p className="mt-0.5 font-mono text-sm text-equb-300/90">{user.phone || '—'}</p>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-black/30 px-3 py-3">
            <div className="flex items-center gap-1.5 text-[10px] text-white/40">
              <Wallet className="h-3 w-3" />
              {t.profile.balance}
            </div>
            <p className="mt-1 text-lg font-black text-gold-400">
              {formatBirrCompact(user.balance, locale)}
            </p>
          </div>
          <div className="rounded-2xl bg-black/30 px-3 py-3">
            <div className="flex items-center gap-1.5 text-[10px] text-white/40">
              <Gift className="h-3 w-3" />
              {t.profile.inviteCode}
            </div>
            <p className="mt-1 font-mono text-sm font-bold tracking-wider text-equb-300">
              {user.referralCode}
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="glass space-y-0 divide-y divide-white/5 rounded-3xl text-sm">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <User className="h-4 w-4 shrink-0 text-equb-400" />
          <div>
            <p className="text-[10px] text-white/40">ሙሉ ስም</p>
            <p className="font-semibold">{user.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3.5">
          <Phone className="h-4 w-4 shrink-0 text-equb-400" />
          <div>
            <p className="text-[10px] text-white/40">ስልክ (ተጠቃሚ ስም)</p>
            <p className="font-mono font-semibold">{user.phone || '—'}</p>
          </div>
        </div>
      </div>

      <Link
        href="/rooms"
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-equb-600 py-3.5 text-sm font-bold text-white"
      >
        ወደ ክበቦች
        <ArrowRight className="h-4 w-4" />
      </Link>

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
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm text-white/45 hover:border-red-500/30 hover:text-red-300"
      >
        <LogOut className="h-4 w-4" />
        {t.common.signOut}
      </button>
    </div>
  );
}
