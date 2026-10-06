/**
 * Barrel for `@/lib/i18n` imports (EqubTable and others).
 * Implementation lives in `./i18n/LanguageContext`.
 */
export {
  LanguageProvider,
  useI18n,
  useLocale,
} from './i18n/LanguageContext';

export { dictionaries } from './i18n/dictionaries';
export type { Locale, Dictionary } from './i18n/dictionaries';
