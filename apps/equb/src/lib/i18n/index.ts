'use client';

/**
 * Folder index so `@/lib/i18n` resolves.
 * Webpack prefers this directory over `lib/i18n.ts`.
 */
export {
  LanguageProvider,
  useI18n,
  useLocale,
  useT,
} from './LanguageContext';

export { dictionaries, interpolate } from './dictionaries';
export type { Locale, Dictionary } from './dictionaries';
