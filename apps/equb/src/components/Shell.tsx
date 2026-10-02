'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEqubStore } from '@/lib/store';
import clsx from 'clsx';

const nav = [
  { href: '/', label: 'Home' },
  { href: '/rooms', label: 'Rooms' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/profile', label: 'Profile' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const user = useEqubStore((s) => s.user);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-3 pb-24 pt-3">
      <header className="mb-4 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-equb-500 text-lg font-black">
            እ
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">Fast Equb</p>
            <p className="text-[10px] text-white/40">ፋስት እቁብ · Demo</p>
          </div>
        </Link>
        {user && (
          <span className="rounded-full bg-equb-500/20 px-3 py-1 text-xs font-semibold text-equb-400">
            {user.balance.toLocaleString()} Birr
          </span>
        )}
      </header>

      <p className="mb-4 text-center text-[11px] text-amber-200/80">
        DEMO — Virtual Birr only. Not real money. Inspired by traditional Equb.
      </p>

      <main className="flex-1">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-surface-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg justify-around px-2 py-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'rounded-xl px-4 py-2 text-xs font-medium',
                path === item.href ? 'bg-equb-500/20 text-equb-400' : 'text-white/40',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
