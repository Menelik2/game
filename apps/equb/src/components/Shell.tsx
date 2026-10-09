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

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const user = useEqubStore((s) => s.user);
  const { t } = useI18n();
  const isPlay = path.startsWith('/rooms/');
  const isRoomsHub = path === '/rooms';
  const isAdmin = path.startsWith('/admin');
  const isAdminUser = sessionIsAdmin(user);

  const nav = [
    { href: '/', label: t.nav.home, icon: Home },
    { href: '/rooms', label: t.nav.rooms, icon: Users },
    { href: '/wallet', label: t.nav.wallet, icon: Wallet },
    { href: '/how-to-play', label: t.nav.howToPlay, icon: CircleHelp },
    { href: '/profile', label: t.nav.profile, icon: User },
  ];

  const contentMax = isAdmin
    ? 'max-w-5xl'
    : isPlay
      ? 'max-w-6xl'
      : isRoomsHub
        ? 'max-w-2xl'
        : 'max-w-lg';

  return (
    <div className="min-h-dvh bg-surface-950 text-white">
      {!isPlay && (
        <header className="sticky top-0 z-40 border-b border-white/5 bg-surface-950/90 backdrop-blur-xl">
          <div
            className={clsx(
              'mx-auto flex items-center justify-between gap-2 px-4 py-3',
              contentMax,
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              {path !== '/' && <BackButton />}
              <Link href="/" className="flex min-w-0 items-center gap-2">
                <BrandLogo />
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!isAdmin && (
                <>
                  <EthDateBadge short />
                  {user && <LiveBalance size="sm" />}
                </>
              )}
              <LanguageSwitcher />
              {isAdminUser && !isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-full border border-amber-500/30 bg-amber-500/10 p-2 text-amber-300"
                  title="Admin"
                >
                  <Shield className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </header>
      )}

      <main
        className={clsx(
          'mx-auto w-full px-4',
          contentMax,
          isPlay ? 'py-3 pb-8' : 'py-4 pb-28',
        )}
      >
        <SiteBanner />
        {children}
      </main>

      {!isPlay && !isAdmin && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-surface-950/95 backdrop-blur-xl">
          <div
            className={clsx(
              'mx-auto grid grid-cols-5 gap-1 px-2 py-2',
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
                  className={clsx(
                    'flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-semibold transition',
                    active
                      ? 'bg-equb-500/20 text-equb-300'
                      : 'text-white/40 hover:text-white/70',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
