'use client';

import clsx from 'clsx';
import { useI18n } from '@/lib/i18n/LanguageContext';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n();

  return (
    <div
      className={clsx(
        'inline-flex h-9 shrink-0 items-center rounded-full border border-white/10 bg-black/40 p-0.5',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale('am')}
        className={clsx(
          'rounded-full px-2 py-1 text-[10px] font-bold transition sm:px-2.5',
          locale === 'am'
            ? 'bg-equb-500 text-white shadow-sm'
            : 'text-white/45 hover:text-white/70',
        )}
      >
        አማ
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={clsx(
          'rounded-full px-2 py-1 text-[10px] font-bold transition sm:px-2.5',
          locale === 'en'
            ? 'bg-equb-500 text-white shadow-sm'
            : 'text-white/45 hover:text-white/70',
        )}
      >
        EN
      </button>
    </div>
  );
}
