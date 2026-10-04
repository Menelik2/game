'use client';

import { useEffect, useRef, useState } from 'react';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { formatBirrCompact } from '@/lib/money';
import clsx from 'clsx';

/**
 * Real-time balance display.
 * - Subscribes to user.balance only (fast re-render)
 * - Animates on change (green credit / red debit)
 * - Polls ledger every 2s while logged in
 */
export function LiveBalance({
  className,
  size = 'sm',
}: {
  className?: string;
  size?: 'sm' | 'lg';
}) {
  const balance = useEqubStore((s) => s.user?.balance ?? null);
  const refreshBalance = useEqubStore((s) => s.refreshBalance);
  const { locale } = useI18n();
  const prev = useRef<number | null>(null);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const [display, setDisplay] = useState<number | null>(balance);

  useEffect(() => {
    if (balance == null) {
      setDisplay(null);
      prev.current = null;
      return;
    }
    if (prev.current != null && prev.current !== balance) {
      setFlash(balance > prev.current ? 'up' : 'down');
      const t = setTimeout(() => setFlash(null), 900);
      prev.current = balance;
      setDisplay(balance);
      return () => clearTimeout(t);
    }
    prev.current = balance;
    setDisplay(balance);
  }, [balance]);

  useEffect(() => {
    if (balance == null) return;
    refreshBalance();
    const id = setInterval(() => refreshBalance(), 2000);
    const onFocus = () => refreshBalance();
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshBalance();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'equb-accounts-v1' || e.key === 'fast-equb-v6') {
        refreshBalance();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('storage', onStorage);
    };
  }, [balance == null, refreshBalance]);

  if (display == null) return null;

  return (
    <div
      className={clsx(
        'rounded-full font-mono font-bold transition-all duration-300',
        size === 'lg' ? 'px-5 py-2 text-2xl' : 'px-3 py-1.5 text-xs sm:text-sm',
        flash === 'up' && 'scale-105 bg-emerald-500/30 text-emerald-300',
        flash === 'down' && 'scale-105 bg-red-500/30 text-red-300',
        !flash && 'bg-equb-500/15 text-equb-400',
        className,
      )}
      title="Balance (live)"
    >
      {formatBirrCompact(display, locale)}
      {flash === 'up' && <span className="ml-1 text-[10px]">▲</span>}
      {flash === 'down' && <span className="ml-1 text-[10px]">▼</span>}
    </div>
  );
}
