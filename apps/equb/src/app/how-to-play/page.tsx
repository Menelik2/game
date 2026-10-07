'use client';

import Link from 'next/link';
import {
  UserPlus,
  Wallet,
  Users,
  Hash,
  Trophy,
  Lightbulb,
  ShieldCheck,
  Smartphone,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { useEqubStore } from '@/lib/store';

function DeviceMock({
  children,
  caption,
}: {
  children: React.ReactNode;
  caption: string;
}) {
  return (
    <figure className="mx-auto w-full max-w-[240px]">
      <div className="relative mx-auto overflow-hidden rounded-[1.6rem] border border-white/12 bg-gradient-to-b from-[#121a18] to-[#070c0a] shadow-[0_24px_48px_rgba(0,0,0,0.55)] ring-1 ring-white/5">
        {/* Status bar */}
        <div className="flex items-center justify-between px-4 pb-1 pt-2.5">
          <span className="text-[9px] font-semibold tabular-nums text-white/40">9:41</span>
          <div className="absolute left-1/2 top-1.5 h-1.5 w-16 -translate-x-1/2 rounded-full bg-black/50" />
          <div className="flex items-center gap-0.5">
            <span className="h-1.5 w-3 rounded-sm bg-white/25" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
          </div>
        </div>
        <div className="min-h-[188px] px-3.5 pb-4 pt-1">{children}</div>
        <div className="mx-auto mb-2 h-1 w-20 rounded-full bg-white/15" />
      </div>
      <figcaption className="mt-2.5 text-center text-[10px] font-medium tracking-wide text-white/35">
        {caption}
      </figcaption>
    </figure>
  );
}

const STEPS = [
  {
    key: 's1' as const,
    icon: UserPlus,
    accent: 'equb',
    mock: (am: boolean) => (
      <div className="space-y-2.5">
        <p className="text-center text-[11px] font-bold text-white/80">
          {am ? 'መለያ ፍጠር' : 'Create account'}
        </p>
        {[
          am ? 'ሙሉ ስም' : 'Full name',
          '09xx xxx xxx',
          am ? 'የይለፍ ቃል' : 'Password',
        ].map((ph) => (
          <div
            key={ph}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[10px] text-white/40"
          >
            {ph}
          </div>
        ))}
        <div className="rounded-xl bg-gradient-to-b from-equb-400 to-equb-600 py-2 text-center text-[11px] font-bold text-white shadow-lg shadow-equb-500/25">
          {am ? 'ተመዝገብ' : 'Register'}
        </div>
      </div>
    ),
  },
  {
    key: 's2' as const,
    icon: Wallet,
    accent: 'gold',
    mock: (am: boolean) => (
      <div className="space-y-2.5">
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-center">
          <p className="text-[9px] uppercase tracking-wider text-white/35">
            {am ? 'ቀሪ ሂሳብ' : 'Balance'}
          </p>
          <p className="mt-0.5 text-xl font-black text-gold-400">0.00</p>
          <p className="text-[9px] text-white/30">ETB</p>
        </div>
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-100/75">
          {am ? 'ቴሌብር የግብይት ቁጥር' : 'Telebirr transaction #'}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 font-mono text-[10px] tracking-wider text-white/55">
          CGE7••••••••
        </div>
        <div className="rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 py-2 text-center text-[11px] font-black text-black shadow-lg shadow-amber-500/20">
          {am ? 'አረጋግጥ እና አስገባ' : 'Verify & credit'}
        </div>
      </div>
    ),
  },
  {
    key: 's3' as const,
    icon: Users,
    accent: 'sky',
    mock: (am: boolean) => (
      <div className="space-y-1.5">
        <p className="mb-1 text-[10px] font-semibold text-white/50">
          {am ? 'ክፍት ክፍሎች' : 'Open rooms'}
        </p>
        {[
          { n: 5, pot: 500, open: true },
          { n: 10, pot: 1000, open: true },
          { n: 15, pot: 2000, open: false },
        ].map((r) => (
          <div
            key={r.n}
            className={clsx(
              'flex items-center justify-between rounded-xl border px-2.5 py-2 text-[10px]',
              r.open
                ? 'border-equb-500/30 bg-equb-500/10'
                : 'border-white/8 bg-white/[0.03] opacity-60',
            )}
          >
            <span className="text-white/75">
              {r.n} {am ? 'ተጫዋቾች' : 'players'}
            </span>
            <span className="font-bold text-gold-400">{r.pot} ብር</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    key: 's4' as const,
    icon: Hash,
    accent: 'violet',
    mock: (am: boolean) => (
      <div className="space-y-2.5">
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const selected = n === 3 || n === 8;
            return (
              <div
                key={n}
                className={clsx(
                  'flex h-7 items-center justify-center rounded-lg text-[9px] font-bold tabular-nums',
                  selected
                    ? 'bg-gradient-to-b from-equb-400 to-equb-600 text-white shadow shadow-equb-500/40'
                    : 'bg-white/[0.07] text-white/45',
                )}
              >
                {String(n).padStart(2, '0')}
              </div>
            );
          })}
        </div>
        <p className="text-center text-[9px] text-white/40">
          {am ? 'ተመርጧል · 03, 08 · ከፍተኛ 2' : 'Selected · 03, 08 · max 2'}
        </p>
        <div className="rounded-xl bg-gradient-to-b from-gold-300 via-gold-400 to-gold-600 py-2.5 text-center text-[12px] font-black tracking-wide text-black shadow-lg shadow-amber-500/30">
          BET
        </div>
      </div>
    ),
  },
  {
    key: 's5' as const,
    icon: Trophy,
    accent: 'gold',
    mock: (am: boolean) => (
      <div className="space-y-3 py-1 text-center">
        <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/35">
          {am ? 'አሸናፊ ቁጥር' : 'Winning number'}
        </p>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-300 to-amber-600 text-2xl font-black text-black shadow-xl shadow-amber-500/30">
          07
        </div>
        <div>
          <p className="text-[12px] font-bold text-equb-300">
            {am ? 'አሸንፈዋል' : 'You won'}
          </p>
          <p className="text-lg font-black text-gold-400">+850 ብር</p>
          <p className="mt-0.5 text-[9px] text-white/35">
            {am ? 'ሽልማት 85% · አስተዳዳሪ 15%' : 'Prize 85% · admin 15%'}
          </p>
        </div>
      </div>
    ),
  },
];

const ACCENT_RING: Record<string, string> = {
  equb: 'from-equb-400 to-equb-700 shadow-equb-500/30',
  gold: 'from-gold-300 to-amber-600 shadow-amber-500/30',
  sky: 'from-sky-400 to-sky-700 shadow-sky-500/25',
  violet: 'from-violet-400 to-violet-700 shadow-violet-500/25',
};

export default function HowToPlayPage() {
  const { t, locale } = useI18n();
  const user = useEqubStore((s) => s.user);
  const am = locale === 'am';
  const h = t.howToPlay;

  const titles = {
    s1: h.s1Title,
    s2: h.s2Title,
    s3: h.s3Title,
    s4: h.s4Title,
    s5: h.s5Title,
  };
  const bodies = {
    s1: h.s1Body,
    s2: h.s2Body,
    s3: h.s3Body,
    s4: h.s4Body,
    s5: h.s5Body,
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0e1a16] via-[#0a1210] to-[#06100c] px-5 py-8 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-equb-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-equb-500/30 bg-equb-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-equb-300">
            <Smartphone className="h-3 w-3" />
            Fast Equb
          </div>
          <h1 className="max-w-lg text-3xl font-black tracking-tight text-white sm:text-4xl">
            {h.title}
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/55 sm:text-base">
            {h.subtitle}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {[
              { icon: ShieldCheck, label: am ? 'እውነተኛ ብር' : 'Real ETB' },
              { icon: Smartphone, label: 'Telebirr' },
              { icon: Trophy, label: am ? '85% አሸናፊ' : '85% winner' },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/60"
              >
                <Icon className="h-3 w-3 text-equb-400" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Progress stepper */}
        <div className="relative mt-8 hidden sm:block">
          <div className="absolute left-[10%] right-[10%] top-4 h-px bg-gradient-to-r from-equb-500/40 via-white/15 to-gold-400/40" />
          <ol className="relative grid grid-cols-5 gap-2">
            {STEPS.map((step, i) => (
              <li key={step.key} className="flex flex-col items-center gap-2 text-center">
                <span
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-black text-white shadow-lg',
                    'bg-gradient-to-br',
                    ACCENT_RING[step.accent],
                  )}
                >
                  {i + 1}
                </span>
                <span className="line-clamp-2 px-1 text-[10px] font-semibold leading-tight text-white/55">
                  {titles[step.key]}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Steps */}
      <div className="space-y-6">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const reverse = i % 2 === 1;
          return (
            <section
              key={step.key}
              className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-xl shadow-black/20 backdrop-blur-sm"
            >
              <div
                className={clsx(
                  'grid items-center gap-6 p-5 sm:gap-8 sm:p-7',
                  'sm:grid-cols-2',
                  reverse && 'sm:[&>div:first-child]:order-2',
                )}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        'flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg',
                        ACCENT_RING[step.accent],
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                        {h.step} {String(i + 1).padStart(2, '0')}
                      </p>
                      <h2 className="text-lg font-bold text-white sm:text-xl">
                        {titles[step.key]}
                      </h2>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-white/55 sm:text-[15px]">
                    {bodies[step.key]}
                  </p>
                  <div className="flex items-center gap-2 text-[12px] font-medium text-equb-300/90">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {i === 0 && (am ? 'ስልክ = የተጠቃሚ ስም' : 'Phone = username')}
                      {i === 1 && (am ? 'ከተረጋገጠ በኋላ ብቻ' : 'Credits after verification')}
                      {i === 2 && (am ? 'ቀጥታ ክፍሎች' : 'Live shared rooms')}
                      {i === 3 && (am ? '5→1 · 10+→2 ቁጥር' : '5→1 · 10+→2 picks')}
                      {i === 4 && (am ? 'አንድ አሸናፊ በዙር' : 'One winner per round')}
                    </span>
                  </div>
                </div>
                <DeviceMock caption={h.shotLabel}>{step.mock(am)}</DeviceMock>
              </div>
            </section>
          );
        })}
      </div>

      {/* Tips */}
      <section className="rounded-3xl border border-equb-500/20 bg-gradient-to-br from-equb-500/10 via-transparent to-amber-500/5 p-5 sm:p-7">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-400/15">
            <Lightbulb className="h-4 w-4 text-gold-400" />
          </span>
          <h3 className="text-base font-bold text-white">{h.tipTitle}</h3>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {[h.tip1, h.tip2, h.tip3].map((tip, i) => (
            <li
              key={tip}
              className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3.5 text-sm leading-relaxed text-white/60"
            >
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-equb-400/80">
                {am ? `ምክር ${i + 1}` : `Tip ${i + 1}`}
              </span>
              {tip}
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-stretch gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-base font-bold text-white">
            {am ? 'ዝግጁ ነዎት?' : 'Ready to play?'}
          </p>
          <p className="mt-0.5 text-sm text-white/45">
            {am
              ? 'ተመዝገቡ፣ ቴሌብር ያስገቡ፣ ክፍል ይቀላቀሉ።'
              : 'Register, deposit Telebirr, join a room.'}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {!user && (
            <Link
              href="/profile"
              className="btn-equb inline-flex items-center justify-center gap-2 px-5 !py-3"
            >
              <UserPlus className="h-4 w-4" />
              {h.ctaRegister}
            </Link>
          )}
          <Link
            href="/wallet"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
          >
            <Wallet className="h-4 w-4 text-gold-400" />
            {h.ctaWallet}
          </Link>
          <Link
            href="/rooms"
            className="btn-gold inline-flex items-center justify-center gap-2 px-5 !py-3"
          >
            {h.ctaRooms}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
