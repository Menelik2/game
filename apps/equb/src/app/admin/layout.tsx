'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ScrollText,
  Server,
  ArrowLeft,
  Shield,
} from 'lucide-react';
import clsx from 'clsx';

const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/audit', label: 'Audit', icon: ScrollText },
  { href: '/admin/system', label: 'System', icon: Server },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-700/20 text-amber-300 ring-1 ring-amber-500/30">
            <Shield className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-amber-100">Admin Console</h1>
            <p className="text-[11px] text-white/40">Equb · operations & control</p>
          </div>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to app
        </Link>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-1.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition',
                active
                  ? 'bg-amber-500/20 text-amber-100 shadow'
                  : 'text-white/45 hover:bg-white/5 hover:text-white/70',
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
