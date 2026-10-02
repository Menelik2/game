'use client';

import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { EthDateBadge } from '@/components/EthDateBadge';
import { formatBirrCompact } from '@/lib/money';
import { Sparkles, Shield, Users, Trophy } from 'lucide-react';

export default function HomePage() {
  const user = useEqubStore((s) => s.user);
  const loginDemo = useEqubStore((s) => s.loginDemo);
  const { t, locale } = useI18n();

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0e1a16] via-[#0a1210] to-[#0c1412] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-equb-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 left-4 h-28 w-28 rounded-full bg-gold-500/15 blur-3xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-equb-500/30 bg-equb-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-equb-300">
              <Sparkles className="h-3 w-3" />
              {t.brandSub}
            </div>
            <h1 className="keno-title leading-tight">{t.home.title}</h1>
            <p className="mt-1.5 text-xs leading-relaxed text-white/50 sm:text-sm">
              {t.home.subtitle}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <LanguageSwitcher />
            <p className="mt-2 text-[10px] text-white/35">{t.common.balance}</p>
            <p className="font-mono text-base font-black text-equb-400 sm:text-lg">
              {user ? formatBirrCompact(user.balance, locale) : '—'}
            </p>
          </div>
        </div>

        <div className="relative mt-4">
          <EthDateBadge />
        </div>
      </section>

      <p className="px-1 text-sm leading-relaxed text-white/65">{t.home.intro}</p>

      {!user ? (
        <button type="button" onClick={() => loginDemo()} className="btn-gold w-full animate-glow">
          {t.common.startDemo}
        </button>
      ) : (
        <Link href="/rooms" className="btn-gold block w-full">
          {t.common.playRooms}
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Users, value: '5–100', label: t.home.seatsLabel },
          { icon: Shield, value: 'CSPRNG', label: t.home.drawLabel },
          { icon: Trophy, value: '1', label: t.home.winnerLabel },
        ].map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="glass flex flex-col items-center rounded-2xl px-2 py-3.5 text-center"
          >
            <Icon className="mb-1.5 h-4 w-4 text-equb-400" />
            <p className="text-sm font-black text-gold-400 sm:text-base">{value}</p>
            <p className="mt-0.5 text-[9px] leading-tight text-white/40 sm:text-[10px]">
              {label}
            </p>
          </div>
        ))}
      </div>

      <div className="glass-strong rounded-2xl p-4 sm:p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gold-400/90">
          {t.home.rulesTitle}
        </p>
        <ol className="mt-3 space-y-2.5 text-xs leading-relaxed text-white/60 sm:text-sm">
          {[t.home.rule1, t.home.rule2, t.home.rule3, t.home.rule4].map((rule, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-equb-500/20 text-[10px] font-bold text-equb-300">
                {i + 1}
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
