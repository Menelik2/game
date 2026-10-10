'use client';

import { useEffect, useRef, useState } from 'react';
import { useEqubStore } from '@/lib/store';
import { getPlayerIdentity, subscribeServerBalance } from '@/lib/multiplayer';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { formatBirrCompact } from '@/lib/money';
import clsx from 'clsx';

export function LiveBalance({
  className,
  size = 'sm',
}: {
  className?: string;
  size?: 'sm' | 'lg';
}) {
  const storeBalance = useEqubStore((s) => s.user?.balance);
  const userId = useEqubStore((s) => s.user?.id);
  const refreshBalance = useEqubStore((s) => s.refreshBalance);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const { locale } = useI18n();

  const [display, setDisplay] = useState<number | null>(storeBalance ?? null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prev = useRef<number | null>(storeBalance ?? null);

  function apply(next: number) {
    if (!Number.isFinite(next)) return;
    if (prev.current != null && prev.current !== next) {
      setFlash(next > prev.current ? 'up' : 'down');
      window.setTimeout(() => setFlash(null), 800);
    }
    prev.current = next;
    setDisplay(next);
  }

  useEffect(() => {
    if (storeBalance == null) {
      setDisplay(null);
      prev.current = null;
      return;
    }
    apply(storeBalance);
  }, [storeBalance]);

  useEffect(() => {
    const onBal = (e: Event) => {
      const d = (e as CustomEvent).detail as {
        balance?: number;
        userId?: string;
      };
      if (d?.userId && userId && d.userId !== userId) return;
      if (typeof d?.balance === 'number') apply(d.balance);
    };
    window.addEventListener('equb:balance', onBal);
    return () => window.removeEventListener('equb:balance', onBal);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeServerBalance(userId, (bal) => {
        if (typeof bal === 'number') apply(bal);
      });
    } catch {
      /* ignore */
    }
    const id = window.setInterval(() => {
      void refreshBalance?.();
    }, 20000);
    return () => {
      window.clearInterval(id);
      unsub?.();
    };
  }, [userId, refreshBalance]);

  if (display == null) return null;

  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-mono font-bold tabular-nums transition-colors',
        size === 'lg'
          ? 'px-4 py-2 text-base'
          : 'h-9 max-w-[7.5rem] px-2.5 text-xs sm:max-w-none sm:px-3 sm:text-sm',
        flash === 'up' && 'bg-equb-500/30 text-equb-200',
        flash === 'down' && 'bg-red-500/25 text-red-200',
        !flash && 'border border-equb-500/30 bg-equb-500/15 text-equb-300',
        className,
      )}
      title={formatBirrCompact(display, locale)}
    >
      <span className="truncate">{formatBirrCompact(display, locale)}</span>
    </span>
  );
}
