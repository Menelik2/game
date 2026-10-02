'use client';

import { useState } from 'react';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function ProfilePage() {
  const user = useEqubStore((s) => s.user);
  const loginDemo = useEqubStore((s) => s.loginDemo);
  const logout = useEqubStore((s) => s.logout);
  const claimReferral = useEqubStore((s) => s.claimReferral);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const { t } = useI18n();

  if (!user) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t.profile.title}</h1>
          <LanguageSwitcher />
        </div>
        <div className="glass rounded-3xl p-6">
          <p className="text-lg font-semibold">{t.profile.guest}</p>
          <p className="mt-1 text-sm text-white/50">{t.profile.guestHint}</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.profile.name}
            className="mt-4 w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
          />
          <button
            type="button"
            onClick={() => loginDemo(name || undefined)}
            className="mt-3 w-full rounded-2xl bg-gold-500 py-3.5 text-sm font-black text-black"
          >
            {t.common.startDemo}
          </button>
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

      <div className="glass rounded-3xl p-5 text-xs text-white/50">
        <p className="font-semibold text-white/80">{t.profile.liveTitle}</p>
        <p className="mt-2">{t.profile.liveHint}</p>
      </div>
    </div>
  );
}
