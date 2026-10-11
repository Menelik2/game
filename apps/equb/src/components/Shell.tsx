'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEqubStore } from '@/lib/store';
import { Home, Users, Wallet, User, Shield, CircleHelp } from 'lucide-react';
import clsx from 'clsx';
import { BackButton } from '@/components/BackButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { EthDateBadge } from '@/components/EthDateBadge';
import { LiveBalance } from '@/components/LiveBalance';
import { BrandLogo } from '@/components/BrandLogo';
import { SiteBanner } from '@/components/SiteBanner';

function sessionIsAdmin(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  return (user as { role?: string }).role === 'admin';
}

function backHref(path: string): string {
  if (path.startsWith('/admin')) return '/admin';
  if (path.startsWith('/rooms/')) return '/rooms';
  if (path === '/rooms') return '/';
  if (path === '/wallet' || path === '/profile' || path === '/how-to-play') {
    return '/';
  }
  return '/';
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const user = useEqubStore((s) => s.user);
  const { t } = useI18n();
  const isPlay = path.startsWith('/rooms/');
  const isRoomsHub = path === '/rooms';
  const isAdmin = path.startsWith('/admin');
  const isAdminUser = sessionIsAdmin(user);
  const showBack = path !== '/';

  const nav = [
    { href: '/', label: t.nav?.home || 'Home', icon: Home },
    { href: '/rooms', label: t.nav?.rooms || 'Rooms', icon: Users },
    { href: '/wallet', label: t.nav?.wallet || 'Wallet', icon: Wallet },
    { href: '/how-to-play', label: t.nav?.howToPlay || 'Help', icon: CircleHelp },
    { href: '/profile', label: t.nav?.profile || 'Profile', icon: User },
  ];

  const contentMax = isAdmin ? 'max-w-5xl' : 'max-w-lg';

  return (
    <div className="min-h-dvh bg-surface-950 text-white">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      {!isPlay && (
        <header className="sticky top-0 z-40 border-b border-white/5 bg-surface-950/95 backdrop-blur-xl">
          <div
            className={clsx(
              'mx-auto flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4',
              contentMax,
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
              {showBack && (
                <BackButton
                  href={backHref(path)}
                  label=""
                  className="!px-2 !py-2 shrink-0"
                />
              )}
              <BrandLogo
                size={36}
                showText
                className="!rounded-lg"
              />
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {!isAdmin && (
                <>
                  <span className="hidden md:inline-flex">
                    <EthDateBadge short />
                  </span>
                  {user && <LiveBalance size="sm" />}
                </>
              )}
              <LanguageSwitcher />
              {isAdminUser && !isAdmin && (
                <Link
                  href="/admin"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 transition hover:bg-amber-500/20 focus-visible:ring-2 focus-visible:ring-amber-400"
                  title="Admin"
                  aria-label="Admin"
                >
                  <Shield className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </div>
          </div>
        </header>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className={clsx(
          'mx-auto w-full px-3 sm:px-4',
          contentMax,
          isPlay ? 'py-3 pb-8' : 'py-4 pb-28',
        )}
      >
        <SiteBanner />
        {children}
      </main>

      {!isPlay && !isAdmin && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-surface-950/95 backdrop-blur-xl safe-pb"
          aria-label="Main"
        >
          <div
            className={clsx(
              'mx-auto grid grid-cols-5 gap-0.5 px-1 py-1.5 sm:gap-1 sm:px-2 sm:py-2',
              contentMax,
            )}
          >
            {nav.map(({ href, label, icon: Icon }) => {
              const active =
                href === '/'
                  ? path === '/'
                  : path === href || path.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-semibold transition focus-visible:ring-2 focus-visible:ring-equb-400',
                    active
                      ? 'bg-equb-500/20 text-equb-300'
                      : 'text-white/40 hover:text-white/70',
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  <span className="max-w-full truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
