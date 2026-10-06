'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AuthForm } from '@/components/AuthForm';
import { formatBirrCompact } from '@/lib/money';

function sessionIsAdmin(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  return (user as { role?: string }).role === 'admin';
}

export default function ProfilePage() {
  const user = useEqubStore((s) => s.user);
  const logout = useEqubStore((s) => s.logout);
  const claimReferral = useEqubStore((s) => s.claimReferral);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const { t, locale } = useI18n();

  if (!user) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t.profile.title}</h1>
          <LanguageSwitcher />
        </div>
        <div className="glass space-y-4 rounded-3xl p-6">
          <p className="text-[11px] text-white/40">
            {locale === 'am'
              ? 'ከመነሻ ገጽ ጋር ተመሳሳይ መግቢያ · ስልክ + የይለፍ ቃል'
              : 'Same login as home · phone + password'}
          </p>
          <AuthForm initialMode="login" redirectTo="/profile" />
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
          <span className="text-white/40">
            {locale === 'am' ? 'ሙሉ ስም' : 'Full name'}
          </span>
          <br />
          <strong>{user.name}</strong>
          {sessionIsAdmin(user) && (
            <span className="ml-2 rounded-full bg-gold-500/20 px-2 py-0.5 text-[10px] font-bold text-gold-400">
              ADMIN
            </span>
          )}
        </p>
        <p>
          <span className="text-white/40">
            {locale === 'am' ? 'ስልክ' : 'Phone'}
          </span>
          <br />
          <strong className="font-mono text-xs">{user.phone || user.email}</strong>
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
      {sessionIsAdmin(user) && (
        <Link href="/admin" className="btn-gold block w-full text-center">
          Admin dashboard
        </Link>
      )}
      {!user.referredBy && !sessionIsAdmin(user) && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-semibold">{t.profile.haveCode}</h2>
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
