'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { formatEthiopianDate, formatEthiopianDateShort } from '@/lib/ethiopian-calendar';

export function EthDateBadge({ short }: { short?: boolean }) {
  const { locale, t } = useI18n();
  const [label, setLabel] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setLabel(
        short
          ? formatEthiopianDateShort(now, locale)
          : formatEthiopianDate(now, locale),
      );
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [locale, short]);

  if (!label) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-1 text-center">
      <p className="text-[9px] uppercase tracking-wider text-white/35">{t.common.ethCalendar}</p>
      <p className="text-[11px] font-semibold text-equb-300">{label}</p>
    </div>
  );
}
