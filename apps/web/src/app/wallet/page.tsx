'use client';

import Link from 'next/link';
import { useEqubStore } from '@/lib/equb-store';
import { STARTING_BALANCE } from '@/lib/equb-logic';

export default function WalletPage() {
  const { user, lang, history } = useEqubStore();
  const t = (am: string, en: string) => (lang === 'am' ? am : en);

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-white/60">{t('መጀመሪያ ይመዝገቡ', 'Register first')}</p>
        <Link href="/profile" className="mt-4 inline-block rounded-xl bg-amber-400 px-6 py-3 font-bold text-black">
          {t('መገለጫ', 'Profile')}
        </Link>
      </div>
    );
  }

  const wins = history.filter((h) => h.won).length;
  const plays = history.length;

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold">{t('ዋሌት', 'Wallet')}</h1>
      <p className="mt-1 text-sm text-white/45">
        {t('ዲሞ ብቻ — ምናባዊ ብር', 'Demo only — virtual birr')}
      </p>

      <div className="mt-6 rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-emerald-900/20 p-6">
        <div className="text-sm text-white/50">{t('ቀሪ ሂሳብ', 'Available balance')}</div>
        <div className="mt-1 text-4xl font-black text-amber-300">
          {user.balance.toLocaleString()}
          <span className="ml-2 text-base font-semibold text-white/40">{t('ብር', 'ETB')}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-xl bg-black/20 p-3">
            <div className="text-white/40">{t('ጀማሪ', 'Start')}</div>
            <div className="font-semibold">{STARTING_BALANCE.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-black/20 p-3">
            <div className="text-white/40">{t('ጨዋታዎች', 'Plays')}</div>
            <div className="font-semibold">{plays}</div>
          </div>
          <div className="rounded-xl bg-black/20 p-3">
            <div className="text-white/40">{t('ድሎች', 'Wins')}</div>
            <div className="font-semibold text-emerald-400">{wins}</div>
          </div>
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-white/50">{t('እንቅስቃሴ', 'Activity')}</h2>
      {history.length === 0 ? (
        <p className="text-sm text-white/40">{t('ገና ምንም የለም', 'Nothing yet')}</p>
      ) : (
        <ul className="space-y-2">
          {history.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">
                  {h.groupSize}p · {h.prizePool.toLocaleString()} · #{h.pick}
                </div>
                <div className="text-xs text-white/35">
                  {new Date(h.at).toLocaleString()} · {t('ዕጣ', 'draw')} #{h.winningNumber}
                </div>
              </div>
              <div className={h.won ? 'font-bold text-emerald-400' : 'text-red-300'}>
                {h.won ? '+' : ''}
                {h.delta.toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/rooms"
        className="mt-8 block rounded-xl bg-emerald-600 py-3 text-center text-sm font-bold"
      >
        {t('ወደ ክፍሎች', 'Back to rooms')}
      </Link>
    </div>
  );
}
