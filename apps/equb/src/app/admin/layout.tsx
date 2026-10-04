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
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-950/50 via-[#0c1210] to-[#0a1210] p-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-700 text-black shadow-lg shadow-amber-500/25">
              <Shield className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-black tracking-tight text-amber-50">Admin Console</h1>
              <p className="text-xs text-amber-200/50">Equb · operations, users & security</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3.5 py-2 text-xs font-medium text-white/55 transition hover:border-amber-500/30 hover:text-amber-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to app
          </Link>
        </div>

        <nav className="relative mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-1.5 backdrop-blur">
          {links.map(({ href, label, icon: Icon }) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition',
                  active
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'text-white/45 hover:bg-white/5 hover:text-white/80',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
