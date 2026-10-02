/**
 * Ethiopian (Ge'ez) calendar conversion.
 * 13 months: 12×30 days + Pagumen 5 or 6 (leap).
 */

export const ETH_MONTHS_AM = [
  'መስከረም', 'ጥቅምት', 'ኅዳር', 'ታኅሳስ', 'ጥር', 'የካቲት', 'መጋቢት',
  'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜን',
] as const;

export const ETH_MONTHS_EN = [
  'Meskerem', 'Tikimt', 'Hidar', 'Tahsas', 'Tir', 'Yekatit', 'Megabit',
  'Miazia', 'Ginbot', 'Sene', 'Hamle', 'Nehasse', 'Pagumen',
] as const;

export type EthDate = { year: number; month: number; day: number };

function isGregLeap(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function isEthLeap(year: number) {
  return year % 4 === 3;
}

export function gregorianToEthiopian(date: Date): EthDate {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();
  const newYearDay = isGregLeap(gy) ? 12 : 11;
  let ey: number;
  if (gm < 9 || (gm === 9 && gd < newYearDay)) {
    ey = gy - 8;
  } else {
    ey = gy - 7;
  }
  const start = new Date(gy, 8, newYearDay);
  let ny = start;
  if (date < start) {
    const prevNyDay = isGregLeap(gy - 1) ? 12 : 11;
    ny = new Date(gy - 1, 8, prevNyDay);
  }
  const diff = Math.floor((date.getTime() - ny.getTime()) / 86400000);
  let month = Math.floor(diff / 30) + 1;
  let day = (diff % 30) + 1;
  if (month > 13) {
    month = 13;
    day = Math.min(day, isEthLeap(ey) ? 6 : 5);
  }
  return { year: ey, month, day };
}

export function formatEthiopianDate(
  date: Date | number,
  locale: 'am' | 'en' = 'am',
): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const e = gregorianToEthiopian(d);
  const months = locale === 'am' ? ETH_MONTHS_AM : ETH_MONTHS_EN;
  const monthName = months[e.month - 1] ?? String(e.month);
  if (locale === 'am') {
    return `${e.day} ${monthName} ${e.year} ዓ.ም.`;
  }
  return `${monthName} ${e.day}, ${e.year} E.C.`;
}

export function formatEthiopianDateShort(
  date: Date | number,
  locale: 'am' | 'en' = 'am',
): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const e = gregorianToEthiopian(d);
  if (locale === 'am') {
    return `${e.day}/${e.month}/${e.year} ዓ.ም.`;
  }
  return `${e.day}/${e.month}/${e.year} E.C.`;
}

export function todayEthiopian(locale: 'am' | 'en' = 'am'): string {
  return formatEthiopianDate(new Date(), locale);
}
