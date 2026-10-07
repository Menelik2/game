'use client';

import Link from 'next/link';
import {
  UserPlus,
  Wallet,
  Users,
  Hash,
  Trophy,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { useEqubStore } from '@/lib/store';

function PhoneFrame({
  title,
  children,
  label,
}: {
  title: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[220px]">
      <p className="mb-1.5 text-center text-[10px] font-medium uppercase tracking-wider text-white/35">
        {label}
      </p>
      <div className="overflow-hidden rounded-[1.35rem] border border-white/15 bg-[#0a1210] shadow-2xl shadow-black/50 ring-1 ring-white/5">
        <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-3 py-1.5">
          <span className="text-[9px] font-semibold text-white/50">{title}</span>
          <span className="h-1.5 w-1.5 rounded-full bg-equb-400/80" />
        </div>
        <div className="min-h-[160px] p-3">{children}</div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    key: 's1' as const,
    icon: UserPlus,
    color: 'from-equb-500/30 to-equb-700/20',
    mock: (am: boolean) => (
      <div className="space-y-2">
        <div className="h-2 w-16 rounded bg-white/10" />
        <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white/50">
          {am ? 'ሙሉ ስም' : 'Full name'}
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white/50">
          09xxxxxxxx
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-white/50">
          ••••••••
        </div>
        <div className="rounded-lg bg-equb-500 py-1.5 text-center text-[10px] font-bold text-white">
          {am ? 'ተመዝገብ' : 'Register'}
        </div>
      </div>
    ),
  },
  {
    key: 's2' as const,
    icon: Wallet,
    color: 'from-amber-500/25 to-amber-700/15',
    mock: (am: boolean) => (
      <div className="space-y-2">
        <p className="text-center text-lg font-black text-gold-400">0 ብር</p>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[9px] text-amber-100/80">
          {am ? 'ቴሌብር ግብይት ቁጥር' : 'Telebirr txn number'}
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-2 font-mono text-[10px] text-white/60">
          CGE12••••••
        </div>
        <div className="rounded-lg bg-gold-400 py-1.5 text-center text-[10px] font-black text-black">
          {am ? 'አረጋግጥ · አስገባ' : 'Verify · Deposit'}
        </div>
      </div>
    ),
  },
  {
    key: 's3' as const,
    icon: Users,
    color: 'from-sky-500/20 to-sky-700/15',
    mock: (am: boolean) => (
      <div className="space-y-1.5">
        {['5 · 500', '10 · 1000', '15 · 2000'].map((r) => (
          <div
            key={r}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px]"
          >
            <span className="text-white/70">
              {r.split(' · ')[0]} {am ? 'ተጫዋቾች' : 'ppl'}
            </span>
            <span className="font-bold text-gold-400">{r.split(' · ')[1]} ብር</span>
          </div>
        ))}
        <p className="pt-1 text-center text-[9px] text-equb-300">
          {am ? 'ክፍት ክፍሎች · ተቀላቀል' : 'Open rooms · Join'}
        </p>
      </div>
    ),
  },
  {
    key: 's4' as const,
    icon: Hash,
    color: 'from-violet-500/20 to-violet-700/15',
    mock: (am: boolean) => (
      <div className="space-y-2">
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <div
              key={n}
              className={`flex h-6 items-center justify-center rounded text-[9px] font-bold ${
                n === 3 || n === 7
                  ? 'bg-equb-500 text-white ring-1 ring-equb-200/50'
                  : 'bg-white/10 text-white/50'
              }`}
            >
              {String(n).padStart(2, '0')}
            </div>
          ))}
        </div>
        <p className="text-center text-[9px] text-white/40">
          {am ? 'ከፍተኛ 2 ቁጥር (10+)' : 'Max 2 picks (10+)'}
        </p>
        <div className="rounded-lg bg-gradient-to-b from-gold-300 to-gold-500 py-1.5 text-center text-[10px] font-black text-black">
          BET
        </div>
      </div>
    ),
  },
  {
    key: 's5' as const,
    icon: Trophy,
    color: 'from-gold-400/25 to-amber-600/20',
    mock: (am: boolean) => (
      <div className="space-y-2 text-center">
        <p className="text-[10px] text-white/45">
          {am ? 'አሸናፊ ቁጥር' : 'Winning number'}
        </p>
        <p className="text-3xl font-black text-gold-400">07</p>
        <p className="text-[10px] font-semibold text-equb-300">
          {am ? 'አሸንፈዋል! +850 ብር' : 'You won! +850 Birr'}
        </p>
        <p className="text-[9px] text-white/35">
          {am ? 'አስተዳዳሪ 15%' : 'Admin fee 15%'}
        </p>
      </div>
    ),
  },
];

export default function HowToPlayPage() {
  const { t, locale } = useI18n();
  const user = useEqubStore((s) => s.user);
  const am = locale === 'am';
  const h = t.howToPlay;

  const titles: Record<(typeof STEPS)[number]['key'], string> = {
    s1: h.s1Title,
    s2: h.s2Title,
    s3: h.s3Title,
    s4: h.s4Title,
    s5: h.s5Title,
  };
  const bodies: Record<(typeof STEPS)[number]['key'], string> = {
    s1: h.s1Body,
    s2: h.s2Body,
    s3: h.s3Body,
    s4: h.s4Body,
    s5: h.s5Body,
  };

  return (
    <div className="space-y-6 pb-8">
      <header className="space-y-2 text-center sm:text-left">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-equb-400/90">
          Fast Equb
        </p>
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          {h.title}
        </h1>
        <p className="max-w-xl text-sm text-white/55">{h.subtitle}</p>
      </header>

      <div className="space-y-5">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <section
              key={step.key}
              className="glass overflow-hidden rounded-2xl border border-white/10"
            >
              <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:p-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-equb-400 to-equb-700 text-sm font-black text-white shadow-lg shadow-equb-500/20">
                      {i + 1}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                      {h.step} {i + 1}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${step.color}`}
                    >
                      <Icon className="h-4 w-4 text-white/90" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-white">
                        {titles[step.key]}
                      </h2>
                      <p className="mt-1 text-sm leading-relaxed text-white/55">
                        {bodies[step.key]}
                      </p>
                    </div>
                  </div>
                </div>
                <PhoneFrame title={titles[step.key]} label={h.shotLabel}>
                  {step.mock(am)}
                </PhoneFrame>
              </div>
            </section>
          );
        })}
      </div>

      <section className="rounded-2xl border border-equb-500/25 bg-equb-500/10 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-gold-400" />
          <h3 className="text-sm font-bold text-white">{h.tipTitle}</h3>
        </div>
        <ul className="space-y-2 text-sm text-white/60">
          {[h.tip1, h.tip2, h.tip3].map((tip) => (
            <li key={tip} className="flex gap-2">
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-equb-400" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {!user && (
          <Link
            href="/profile"
            className="btn-equb inline-flex items-center justify-center gap-2 px-5"
          >
            <UserPlus className="h-4 w-4" />
            {h.ctaRegister}
          </Link>
        )}
        <Link
          href="/wallet"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/10"
        >
          <Wallet className="h-4 w-4 text-gold-400" />
          {h.ctaWallet}
        </Link>
        <Link
          href="/rooms"
          className="btn-gold inline-flex items-center justify-center gap-2 px-5"
        >
          <Users className="h-4 w-4" />
          {h.ctaRooms}
        </Link>
      </div>
    </div>
  );
}
