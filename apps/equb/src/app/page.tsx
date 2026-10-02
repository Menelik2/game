'use client';

import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default function HomePage() {
  const user = useEqubStore((s) => s.user);
  const loginDemo = useEqubStore((s) => s.loginDemo);
  const { t } = useI18n();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="keno-title">{t.home.title}</h1>
          <p className="text-[11px] text-white/40">{t.home.subtitle}</p>
        </div>
        <div className="text-right">
          <LanguageSwitcher />
          <p className="mt-1 text-[10px] text-white/40">{t.common.balance}</p>
          <p className="font-mono text-sm font-bold text-equb-400">
            {user ? user.balance.toLocaleString() : '—'}
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="text-sm leading-relaxed text-white/70">{t.home.intro}</p>
      </div>

      {!user ? (
        <button
          type="button"
          onClick={() => loginDemo()}
          className="w-full rounded-2xl bg-gold-500 py-4 text-sm font-black text-black"
        >
          {t.common.startDemo}
        </button>
      ) : (
        <Link
          href="/rooms"
          className="block w-full rounded-2xl bg-gold-500 py-4 text-center text-sm font-black text-black"
        >
          {t.common.playRooms}
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { v: '5–100', s: t.home.seatsLabel },
          { v: 'CSPRNG', s: t.home.drawLabel },
          { v: '1', s: t.home.winnerLabel },
        ].map((x) => (
          <div key={x.s} className="glass rounded-xl py-3">
            <p className="text-sm font-black text-gold-400">{x.v}</p>
            <p className="text-[10px] text-white/40">{x.s}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gold-400/80">
          {t.home.rulesTitle}
        </p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-[11px] text-white/55">
          <li>{t.home.rule1}</li>
          <li>{t.home.rule2}</li>
          <li>{t.home.rule3}</li>
          <li>{t.home.rule4}</li>
        </ol>
      </div>
    </div>
  );
}
