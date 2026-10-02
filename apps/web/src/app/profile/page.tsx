'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEqubStore } from '@/lib/equb-store';
import { STARTING_BALANCE } from '@/lib/equb-logic';

export default function ProfilePage() {
  const { user, register, logout, lang, history } = useEqubStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const t = (am: string, en: string) => (lang === 'am' ? am : en);

  const onRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = register(name);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push('/rooms');
  };

  if (user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <h1 className="text-2xl font-bold">{t('መገለጫ', 'Profile')}</h1>
        <div className="mt-6 space-y-4 rounded-2xl border border-emerald-900/50 bg-emerald-950/30 p-6">
          <div>
            <div className="text-xs text-white/40">{t('ስም', 'Name')}</div>
            <div className="text-xl font-semibold text-emerald-200">{user.name}</div>
          </div>
          <div>
            <div className="text-xs text-white/40">{t('መለያ', 'Player ID')}</div>
            <div className="break-all font-mono text-xs text-white/50">{user.playerId}</div>
          </div>
          <div>
            <div className="text-xs text-white/40">{t('ቀሪ ሂሳብ', 'Balance')}</div>
            <div className="text-2xl font-bold text-amber-300">
              {user.balance.toLocaleString()} {t('ብር', 'ETB')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full rounded-xl border border-red-500/40 py-3 text-sm text-red-300 hover:bg-red-500/10"
          >
            {t('ውጣ', 'Log out')}
          </button>
        </div>

        {history.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-white/60">{t('ታሪክ', 'History')}</h2>
            <ul className="space-y-2">
              {history.slice(0, 20).map((h) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                >
                  <span>
                    {h.groupSize}p · {h.prizePool} · #{h.pick}
                    {h.won ? (
                      <span className="ml-2 text-emerald-400">{t('አሸነፈ', 'Won')}</span>
                    ) : (
                      <span className="ml-2 text-white/40">#{h.winningNumber}</span>
                    )}
                  </span>
                  <span className={h.won ? 'text-emerald-400' : 'text-red-300'}>
                    {h.delta > 0 ? '+' : ''}
                    {h.delta}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-bold">{t('መገለጫ', 'Profile')}</h1>
      <p className="mt-2 text-white/50">
        {t('ስምዎን ያስገቡ እና ይጀምሩ', 'Enter your name to start')}
      </p>
      <form onSubmit={onRegister} className="mt-8 space-y-4 rounded-2xl border border-emerald-900/50 bg-emerald-950/40 p-6">
        <div>
          <div className="mb-1 text-sm font-medium text-emerald-200">
            {t('እንኳን ደህና መጡ', 'Welcome')}
          </div>
          <p className="mb-4 text-xs text-white/45">
            {t(
              `ስምዎን ያስገቡ እና ይጀምሩ — ${STARTING_BALANCE.toLocaleString()} ምናባዊ ብር`,
              `Enter your name — ${STARTING_BALANCE.toLocaleString()} virtual birr`,
            )}
          </p>
          {error && (
            <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('ስም', 'Name')}
            required
            minLength={2}
            maxLength={40}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-amber-400 py-3.5 text-sm font-bold text-black hover:bg-amber-300"
        >
          {t(`ጀምር · ${STARTING_BALANCE.toLocaleString()} ምናባዊ ብር`, `Start · ${STARTING_BALANCE.toLocaleString()} virtual birr`)}
        </button>
      </form>
      <p className="mt-4 text-center text-xs text-white/35">
        {t(
          'እያንዳንዱ ተጠቃሚ የራሱ መለያ እና ሂሳብ አለው። ዲሞ ብቻ — እውነተኛ ገንዘብ አይደለም።',
          'Every user gets a unique id and balance. Demo only — not real money.',
        )}
      </p>
    </div>
  );
}
