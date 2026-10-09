'use client';

import { maxPicksForGroup, GROUP_SIZES } from '@/lib/equb-math';
import clsx from 'clsx';

/** Compact badge for a group size */
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
      <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">
        {am
          ? '5 ተጫዋቾች = 1 ቁጥር · ቡድኑ ሲጨምር ቁጥር ምርጫ በ1 ይጨምራል'
          : '5 players = 1 number · each larger group +1 pick'}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {GROUP_SIZES.slice(0, 6).map((g) => {
          const m = maxPicksForGroup(g);
          const active = g === groupSize;
          return (
            <span
              key={g}
              className={clsx(
                'rounded-lg border px-2 py-1 text-[10px] font-bold tabular-nums',
                active
                  ? 'border-equb-400/50 bg-equb-500/25 text-equb-100'
                  : 'border-white/10 bg-black/30 text-white/50',
              )}
            >
              {g}→{m}
            </span>
          );
        })}
        <span className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[10px] text-white/40">
          …100→11
        </span>
      </div>
      <p className="mt-2.5 text-center text-xs font-semibold text-white/80">
        {am
          ? `ይህ ክፍል · ከፍተኛ ${max} ቁጥር ይምረጡ`
          : `This room · pick up to ${max} number${max > 1 ? 's' : ''}`}
      </p>
    </div>
  );
}

/** Short line under group-size chips */
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
        ? `ህግ፡ 5 = 1 ቁጥር · 10 = 2 · 20 = 3 · … · አሁን ከፍተኛ ${max}`
        : `Rule: 5=1 · 10=2 · 20=3 · … · now max ${max}`}
    </p>
  );
}
