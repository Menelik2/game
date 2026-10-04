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
    refreshBalance();
    const id = window.setInterval(() => refreshBalance(), 1500);
    const onFocus = () => refreshBalance();
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshBalance();
    };
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === 'equb-accounts-v1' ||
        e.key === 'fast-equb-v6' ||
        e.key?.startsWith('fast-equb')
      ) {
        refreshBalance();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('storage', onStorage);
    };
  }, [userId, refreshBalance]);

  // Backend SSE real-time balance
  useEffect(() => {
    if (!userId) return;
    const { playerId } = getPlayerIdentity();
    const unsub = subscribeServerBalance(playerId, (ev) => {
      if (typeof ev.balance !== 'number') return;
      apply(ev.balance);
      const cur = useEqubStore.getState().user;
      if (cur && Math.abs(cur.balance - ev.balance) > 0.001) {
        setSessionUser({ ...cur, balance: ev.balance });
      }
    });
    return unsub;
  }, [userId, setSessionUser]);

  if (display == null || !userId) return null;

  return (
    <div
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-full font-mono font-bold transition-all duration-300',
        size === 'lg'
          ? 'px-5 py-2.5 text-2xl'
          : 'px-3 py-1.5 text-xs sm:text-sm',
        flash === 'up' &&
          'scale-110 bg-emerald-500/35 text-emerald-200 shadow-lg shadow-emerald-500/20',
        flash === 'down' &&
          'scale-110 bg-red-500/35 text-red-200 shadow-lg shadow-red-500/20',
        !flash && 'bg-equb-500/15 text-equb-400',
        className,
      )}
      aria-live="polite"
      aria-atomic="true"
      title="Live balance"
    >
      {formatBirrCompact(display, locale)}
      {flash === 'up' && <span className="text-[10px]">▲</span>}
      {flash === 'down' && <span className="text-[10px]">▼</span>}
    </div>
  );
}
