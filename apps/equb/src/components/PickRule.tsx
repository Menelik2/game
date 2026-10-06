'use client';

import { maxPicksForGroup } from '@/lib/equb-math';
import clsx from 'clsx';

/** Compact badge: “max 1” / “max 2” for a group size */
export function PickRuleBadge({
  groupSize,
  locale = 'am',
  className,
}: {
  groupSize: number;
  locale?: string;
  className?: string;
}) {
  const max = maxPicksForGroup(groupSize);
  const am = locale === 'am';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
        max === 1
          ? 'bg-sky-500/20 text-sky-300'
          : 'bg-amber-500/20 text-amber-200',
        className,
      )}
    >
      {am ? `ከፍተኛ ${max}` : `max ${max}`}
    </span>
  );
}

/** Full rule card shown on Rooms page */
export function PickRuleCard({
  groupSize,
  locale = 'am',
  className,
}: {
  groupSize: number;
  locale?: string;
  className?: string;
}) {
  const max = maxPicksForGroup(groupSize);
  const am = locale === 'am';

  return (
    <div
      className={clsx(
        'rounded-2xl border border-equb-500/30 bg-gradient-to-br from-equb-500/15 to-black/40 p-3.5',
        className,
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-equb-300/90">
        {am ? 'የቁጥር ምርጫ ህግ' : 'Number pick rule'}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div
          className={clsx(
            'rounded-xl border px-3 py-2',
            groupSize <= 5
              ? 'border-sky-400/40 bg-sky-500/15'
              : 'border-white/10 bg-black/30',
          )}
        >
          <p className="text-[10px] text-white/45">
            {am ? '5 ተጫዋቾች' : '5 players'}
          </p>
          <p className="mt-0.5 text-sm font-black text-sky-200">
            {am ? '1 ቁጥር' : '1 number'}
          </p>
        </div>
        <div
          className={clsx(
            'rounded-xl border px-3 py-2',
            groupSize > 5
              ? 'border-amber-400/40 bg-amber-500/15'
              : 'border-white/10 bg-black/30',
          )}
        >
          <p className="text-[10px] text-white/45">
            {am ? '10+ ተጫዋቾች' : '10+ players'}
          </p>
          <p className="mt-0.5 text-sm font-black text-amber-200">
            {am ? '2 ቁጥሮች' : '2 numbers'}
          </p>
        </div>
      </div>
      <p className="mt-2.5 text-center text-xs font-semibold text-white/80">
        {am
          ? `ይህ ክፍል · ከፍተኛ ${max} ቁጥር ይምረጡ`
          : `This room · pick up to ${max} number${max > 1 ? 's' : ''}`}
      </p>
    </div>
  );
}

/** One-line helper under group size chips */
export function PickRuleHint({
  groupSize,
  locale = 'am',
}: {
  groupSize: number;
  locale?: string;
}) {
  const max = maxPicksForGroup(groupSize);
  const am = locale === 'am';
  return (
    <p className="mt-2 text-[11px] leading-relaxed text-equb-200">
      {am
        ? `ህግ፡ 5 ተጫዋቾች = 1 ቁጥር · 10 እና ከዚያ በላይ = 2 ቁጥሮች · አሁን ከፍተኛ ${max}`
        : `Rule: 5 players = 1 number · 10+ = 2 numbers · now max ${max}`}
    </p>
  );
}
