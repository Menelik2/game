'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEqubStore } from '@/lib/store';
import { Home, Users, Wallet, User, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { BackButton } from '@/components/BackButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { EthDateBadge } from '@/components/EthDateBadge';
import { formatBirrCompact } from '@/lib/money';

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const user = useEqubStore((s) => s.user);
  const { t, locale } = useI18n();
  const isPlay = path.startsWith('/rooms/');

  const nav = [
    { href: '/', label: t.nav.home, icon: Home },
    { href: '/rooms', label: t.nav.rooms, icon: Users },
    { href: '/wallet', label: t.nav.wallet, icon: Wallet },
    { href: '/profile', label: t.nav.profile, icon: User },
  ];

  return (
    <div
      className={clsx(
        'mx-auto flex min-h-dvh w-full flex-col',
        isPlay ? 'max-w-5xl' : 'max-w-lg',
      )}
    >
      <header className="sticky top-0 z-30 border-b border-white/10 bg-surface-950/95 px-3 py-2 backdrop-blur-xl sm:px-4 sm:py-3 safe-top">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2">
          {path !== '/' && (
            <BackButton
              href={path.startsWith('/rooms/') ? '/rooms' : '/'}
              label={path.startsWith('/rooms/') ? t.common.backRooms : t.common.backHome}
              className="shrink-0 !px-2 !py-1.5 text-xs"
            />
          )}
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-equb-500 to-equb-700 shadow-lg shadow-equb-500/20 sm:h-9 sm:w-9">
              <Sparkles className="h-4 w-4 text-white sm:h-5 sm:w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold leading-tight sm:text-sm">{t.brand}</p>
              <p className="truncate text-[9px] text-equb-400 sm:text-[10px]">{t.brandSub}</p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <LanguageSwitcher compact />
            {user ? (
              <div className="max-w-[5.5rem] truncate rounded-full bg-equb-500/15 px-2 py-1 text-[10px] font-semibold text-equb-400 sm:max-w-none sm:px-2.5 sm:text-[11px]">
                {formatBirrCompact(user.balance, locale)}
              </div>
            ) : (
              <Link href="/profile" className="text-[10px] font-medium text-equb-400 sm:text-[11px]">
                {t.common.signIn}
              </Link>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 sm:mt-2 sm:gap-2">
          <EthDateBadge short />
          <p className="text-center text-[9px] leading-snug text-amber-400/90 sm:text-[10px]">
            {t.demoBanner}
          </p>
        </div>
      </header>

      <main className="flex-1 px-2 py-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:px-4 sm:py-4">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-surface-950/95 backdrop-blur-xl safe-bottom">
        <div className="mx-auto flex max-w-5xl justify-around pb-[env(safe-area-inset-bottom)] pt-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex min-w-[3.5rem] flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] touch-manipulation',
                  active ? 'text-equb-400' : 'text-white/40',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
