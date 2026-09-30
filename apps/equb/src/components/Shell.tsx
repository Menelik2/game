'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEqubStore } from '@/lib/store';
import { Home, Users, Wallet, User, Sparkles } from 'lucide-react';
import clsx from 'clsx';

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const user = useEqubStore((s) => s.user);
  const nav = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/rooms', label: 'Rooms', icon: Users },
    { href: '/wallet', label: 'Wallet', icon: Wallet },
    { href: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-surface-950/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-equb-500 to-equb-700 shadow-lg shadow-equb-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight">Fast Equb</p>
              <p className="text-[10px] text-equb-400">ፋስት እቁብ · Demo</p>
            </div>
          </Link>
          {user ? (
            <div className="rounded-full bg-equb-500/15 px-3 py-1 text-xs font-semibold text-equb-400">
              {user.balance.toLocaleString()} <span className="text-white/40">Birr</span>
            </div>
          ) : (
            <Link href="/profile" className="text-xs font-medium text-equb-400">
              Sign in
            </Link>
          )}
        </div>
        <p className="mt-2 text-center text-[10px] text-amber-400/90">
          DEMO — Virtual Birr only. Not real money. Inspired by traditional Equb.
        </p>
      </header>
      <main className="flex-1 px-4 py-4 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-surface-950/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg justify-around py-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex flex-col items-center gap-0.5 px-3 py-1 text-[10px]',
                  active ? 'text-equb-400' : 'text-white/40',
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
