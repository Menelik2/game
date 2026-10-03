'use client';

import Link from 'next/link';
import { useEqubStore } from '@/lib/equb-store';
import { STARTING_BALANCE } from '@/lib/equb-logic';

export default function HomePage() {
  const { user, lang } = useEqubStore();
  const t = (am: string, en: string) => (lang === 'am' ? am : en);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-3xl border border-emerald-900/50 bg-gradient-to-b from-emerald-950/80 to-[#0a1210] p-8 shadow-2xl">
        <div className="mb-4 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          {t('ባህላዊ እቁብ · ዲሞ ምናባዊ ብር', 'Traditional Equb · demo virtual birr')}
        </div>
        <h1 className="text-4xl font-black tracking-tight text-amber-300 md:text-5xl">
          {t('እቁብ', 'Equb')}
        </h1>
        <p className="mt-2 text-lg text-white/60">
          {t('አብረን እንቆጥባለን · በተራ እንቀበላለን', 'We save together · we receive in turn')}
        </p>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/55">
          {t(
            'እቁብ የኢትዮጵያ ባህላዊ የቁጠባ ክበብ ነው። አባላት ተመሳሳይ መጠን ያስገባሉ። በእያንዳንዱ ዙር አንድ አባል ሙሉ ገንዘቡን ይቀበላል። ይህ መተግበሪያ ያንን ልምድ በዲጂታል መልኩ ያሳያል — አሁን ዲሞ በምናባዊ ብር ብቻ።',
            'Equb is Ethiopia’s traditional rotating savings circle. Members contribute the same amount. Each cycle, one member receives the full pot. This app shows that practice digitally — currently demo with virtual birr only.',
          )}
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
          <span className="text-white/50">{t('የእርስዎ ቁጠባ', 'Your savings balance')}: </span>
          <span className="font-bold text-amber-300">
            {user ? `${user.balance.toLocaleString()} ${t('ብር', 'ETB')}` : '—'}
          </span>
        </div>

        <Link
          href={user ? '/rooms' : '/profile'}
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-base font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 sm:w-auto"
        >
          {user
            ? t('ወደ ክበቦች', 'Go to circles')
            : t(
                `ተቀላቀል · ${STARTING_BALANCE.toLocaleString()} ምናባዊ ብር`,
                `Join · ${STARTING_BALANCE.toLocaleString()} virtual birr`,
              )}
        </Link>

        <p className="mt-4 text-xs text-white/35">
          {t(
            'ዲሞ ብቻ — እውነተኛ ክፍያ ወይም ቴሌብር ገና አይደለም።',
            'Demo only — not real payments or Telebirr yet.',
          )}
        </p>
      </section>

      <aside className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-2xl font-bold text-amber-300">5–100</div>
          <div className="text-sm text-white/50">{t('አባላት በክበብ', 'Members per circle')}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-2xl font-bold text-emerald-300">{t('ፍትሃዊ', 'Fair')}</div>
          <div className="text-sm text-white/50">{t('የተራ ምርጫ', 'Turn selection')}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-2xl font-bold text-amber-300">1</div>
          <div className="text-sm text-white/50">{t('ተቀባይ በዙር', 'Receiver per cycle')}</div>
        </div>
        <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/40 p-5 text-sm text-white/70">
          <div className="mb-2 font-semibold text-emerald-300">{t('እንዴት ይሰራል', 'How it works')}</div>
          <ol className="list-decimal space-y-1.5 pl-4">
            <li>{t('የክበብ መጠን ይምረጡ (ስንት አባላት)', 'Choose circle size (how many members)')}</li>
            <li>{t('የእርስዎን ቁጥር / ተራ ይምረጡ', 'Pick your number / turn')}</li>
            <li>{t('የመዋጮ መጠን (ገንዘብ) ይምረጡ', 'Choose the contribution (pot size)')}</li>
            <li>{t('ክበቡ ሲሞላ አንድ አባል ሙሉ ገንዘቡን ይቀበላል', 'When the circle is full, one member receives the pot')}</li>
          </ol>
        </div>
        <div className="flex gap-3 text-xs text-white/40">
          <Link href="/terms" className="underline hover:text-white/70">
            {t('ደንቦች', 'Terms')}
          </Link>
          <Link href="/privacy" className="underline hover:text-white/70">
            {t('ግላዊነት', 'Privacy')}
          </Link>
        </div>
      </aside>
    </div>
  );
}
