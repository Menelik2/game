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
          {t('ዲሞ · ምናባዊ ብር', 'Demo · virtual birr')}
        </div>
        <h1 className="text-4xl font-black tracking-tight text-amber-300 md:text-5xl">
          {t('ፋስት እቁብ', 'Fast Equb')}
        </h1>
        <p className="mt-2 text-white/60">
          {t('ፋስት እቁብ · ምረጥ · ዕጣ · አንድ አሸናፊ', 'Pick · draw · one winner')}
        </p>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/55">
          {t(
            'ከኢትዮጵያ እቁብ ክበቦች የተነሳሳ። ሁሉም ተመሳሳይ መግቢያ ይከፍላሉ። ኮምፒውተሩ አንድ ቁጥር ይመርጣል። ያ ተጫዋች ሙሉ ሽልማቱን ያሸንፋል።',
            'Inspired by Ethiopian equb circles. Everyone pays the same stake. A fair draw picks one number. That player wins the full pot.',
          )}
        </p>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
          <span className="text-white/50">{t('ቀሪ ሂሳብ', 'Balance')}: </span>
          <span className="font-bold text-amber-300">
            {user ? `${user.balance.toLocaleString()} ${t('ብር', 'ETB')}` : '—'}
          </span>
        </div>

        <Link
          href={user ? '/rooms' : '/profile'}
          className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-base font-bold text-black shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 sm:w-auto"
        >
          {user
            ? t('ወደ ክፍሎች', 'Go to rooms')
            : t(`ጀምር · ${STARTING_BALANCE.toLocaleString()} ምናባዊ ብር`, `Start · ${STARTING_BALANCE.toLocaleString()} virtual birr`)}
        </Link>
      </section>

      <aside className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-2xl font-bold text-amber-300">5–100</div>
          <div className="text-sm text-white/50">{t('መቀመጫ', 'Seats')}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-2xl font-bold text-emerald-300">CSPRNG</div>
          <div className="text-sm text-white/50">{t('ዕጣ', 'Fair draw')}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-2xl font-bold text-amber-300">1</div>
          <div className="text-sm text-white/50">{t('አሸናፊ', 'Winner')}</div>
        </div>
        <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/40 p-5 text-sm text-white/70">
          <div className="mb-2 font-semibold text-emerald-300">{t('ደንቦች', 'Rules')}</div>
          <ol className="list-decimal space-y-1 pl-4">
            <li>{t('ክፍል ይምረጡ (ቁጥር እና ሽልማት)', 'Choose room size and prize')}</li>
            <li>{t('በሰሌዳው ላይ አንድ ልዩ ቁጥር ይምረጡ', 'Pick a unique number on the board')}</li>
            <li>{t('መቀመጫዎችን ይሙሉ (ጓደኞች ወይም ዲሞ ቦቶች)', 'Fill seats (friends or demo bots)')}</li>
            <li>{t('ክሪፕቶ ዕጣ → የሚመሳሰል ቁጥር ሽልማቱን ያሸንፋል', 'Crypto draw → matching number wins the pot')}</li>
          </ol>
        </div>
      </aside>
    </div>
  );
}
