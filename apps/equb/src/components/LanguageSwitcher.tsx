'use client';

import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/LanguageContext';

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className={clsx(
        'inline-flex rounded-full border border-white/10 bg-black/30 p-0.5',
        compact && 'scale-90',
      )}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale('am')}
        className={clsx(
          'rounded-full px-2 py-0.5 text-[10px] font-bold transition',
          locale === 'am' ? 'bg-equb-500 text-white' : 'text-white/45 hover:text-white/70',
        )}
      >
        አማ
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={clsx(
          'rounded-full px-2 py-0.5 text-[10px] font-bold transition',
          locale === 'en' ? 'bg-equb-500 text-white' : 'text-white/45 hover:text-white/70',
        )}
      >
        EN
      </button>
    </div>
  );
}
