'use client';

import { useI18n } from '@/lib/i18n/LanguageContext';
import clsx from 'clsx';

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={clsx(
        'inline-flex rounded-xl border border-white/10 bg-black/40 p-0.5',
        compact && 'text-[10px]',
      )}
      role="group"
      aria-label={t.common.language}
    >
      <button
        type="button"
        onClick={() => setLocale('am')}
        className={clsx(
          'rounded-lg px-2.5 py-1 font-semibold transition',
          compact ? 'text-[10px]' : 'text-xs',
          locale === 'am'
            ? 'bg-equb-500 text-white'
            : 'text-white/50 hover:text-white',
        )}
      >
        አማ
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={clsx(
          'rounded-lg px-2.5 py-1 font-semibold transition',
          compact ? 'text-[10px]' : 'text-xs',
          locale === 'en'
            ? 'bg-equb-500 text-white'
            : 'text-white/50 hover:text-white',
        )}
      >
        EN
      </button>
    </div>
  );
}
