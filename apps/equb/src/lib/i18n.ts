'use client';

/**
 * Barrel for `@/lib/i18n`.
 * EqubTable imports `useT` and `useLocale` from this path.
 */
export {
  LanguageProvider,
  useI18n,
  useLocale,
} from './i18n/LanguageContext';

export { useT } from './i18n/LanguageContext';

export { dictionaries, interpolate } from './i18n/dictionaries';
export type { Locale, Dictionary } from './i18n/dictionaries';
