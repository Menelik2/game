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
        ? 'max-w-5xl'
        : 'max-w-3xl';

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-surface-950/95 backdrop-blur-xl safe-top">
        <div
          className={clsx(
            'mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8',
            contentMax,
          )}
        >
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {path !== '/' && (
              <BackButton
                href={
                  path.startsWith('/rooms/')
                    ? '/rooms'
                    : path.startsWith('/admin')
                      ? '/'
                      : '/'
                }
                label={path.startsWith('/rooms/') ? t.common.backRooms : t.common.backHome}
                className="shrink-0 !px-2 !py-1.5 text-xs lg:hidden"
              />
            )}
            <BrandLogo size={40} title={t.brand} subtitle={t.brandSub} />
          </div>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map(({ href, label, icon: Icon }) => {
              const active =
                path === href ||
                (href === '/rooms' && path.startsWith('/rooms')) ||
                (href === '/how-to-play' && path.startsWith('/how-to-play'));
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition',
                    active
                      ? 'bg-equb-500/15 text-equb-300'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
            {isAdminUser && (
              <Link
                href="/admin"
                className={clsx(
                  'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition',
                  isAdmin
                    ? 'bg-amber-500/15 text-amber-200'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80',
                )}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <EthDateBadge short />
            </div>
            <LanguageSwitcher compact />
            {user ? (
              <LiveBalance />
            ) : (
              <Link
                href="/profile"
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-equb-400 hover:bg-white/5"
              >
                {t.common.signIn}
              </Link>
            )}
          </div>
        </div>
        <p className="border-t border-white/5 px-4 py-1 text-center text-[9px] text-amber-400/80 sm:text-[10px] lg:hidden">
          {t.demoBanner}
        </p>
      </header>

      <main
        className={clsx(
          'mx-auto w-full flex-1 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8',
          'pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:pb-10',
          contentMax,
        )}
      >
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-surface-950/95 backdrop-blur-xl safe-bottom lg:hidden">
        <div className="mx-auto flex max-w-lg justify-around pb-[env(safe-area-inset-bottom)] pt-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex min-w-[3rem] flex-col items-center gap-0.5 px-1.5 py-1.5 text-[9px] touch-manipulation sm:min-w-[3.5rem] sm:px-2 sm:text-[10px]',
                  active ? 'text-equb-400' : 'text-white/40',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
          {isAdminUser && (
            <Link
              href="/admin"
              className={clsx(
                'flex min-w-[3.5rem] flex-col items-center gap-0.5 px-2 py-1.5 text-[10px]',
                isAdmin ? 'text-amber-300' : 'text-white/40',
              )}
            >
              <Shield className="h-5 w-5" />
              <span>Admin</span>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
