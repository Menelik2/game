'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ArrowLeft, Shield } from 'lucide-react';
import clsx from 'clsx';

const links = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-amber-100">Admin</h1>
            <p className="text-[11px] text-white/40">Equb control panel</p>
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          App
        </Link>
      </div>

      <nav className="flex gap-2 overflow-x-auto pb-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap',
                active
                  ? 'bg-amber-500/20 text-amber-200'
                  : 'bg-white/5 text-white/45 hover:bg-white/10',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
