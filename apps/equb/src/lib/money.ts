/** Ethiopian money unit: Birr (ብር) / ETB — virtual demo credits. */

export const MONEY_CODE = 'ETB';
export const MONEY_SYMBOL_AM = 'ብር';
export const MONEY_SYMBOL_EN = 'Birr';
export const MONEY_FULL_AM = 'ኢትዮጵያ ብር';
export const MONEY_FULL_EN = 'Ethiopian Birr';

export type MoneyLocale = 'am' | 'en';

export function formatBirr(
  amount: number,
  locale: MoneyLocale = 'am',
  opts?: { showCode?: boolean; decimals?: number },
): string {
  const decimals = opts?.decimals ?? (Number.isInteger(amount) ? 0 : 2);
  const n = amount.toLocaleString(locale === 'am' ? 'am-ET' : 'en-ET', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const unit = locale === 'am' ? MONEY_SYMBOL_AM : MONEY_SYMBOL_EN;
  if (opts?.showCode) {
    return `${n} ${unit} (${MONEY_CODE})`;
  }
  return `${n} ${unit}`;
}

export function formatBirrCompact(amount: number, locale: MoneyLocale = 'am'): string {
  return formatBirr(amount, locale, { decimals: 0 });
}

export function formatBirrSigned(amount: number, locale: MoneyLocale = 'am'): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
  return `${sign}${formatBirrCompact(Math.abs(amount), locale)}`;
}

export function moneyUnitLabel(locale: MoneyLocale = 'am'): string {
  return locale === 'am' ? MONEY_SYMBOL_AM : MONEY_SYMBOL_EN;
}

export function moneyFullLabel(locale: MoneyLocale = 'am'): string {
  return locale === 'am' ? MONEY_FULL_AM : MONEY_FULL_EN;
}
