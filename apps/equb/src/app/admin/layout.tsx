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
  Landmark,
  Radio,
  Smartphone,
  TrendingUp,
} from 'lucide-react';
import clsx from 'clsx';
import { AdminGuard } from '@/components/AdminGuard';

const links = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/telebirr', label: 'Telebirr', icon: Smartphone },
  { href: '/admin/deposits', label: 'Deposits', icon: Landmark },
  { href: '/admin/profit', label: 'Profit', icon: TrendingUp },
  { href: '/admin/audit', label: 'Audit', icon: ScrollText },
  { href: '/admin/system', label: 'System', icon: Server },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/25 bg-gradient-to-br from-amber-950/60 via-[#0c1210] to-[#0a1210] p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-8 left-10 h-32 w-32 rounded-full bg-equb-500/10 blur-3xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-700 text-black shadow-lg shadow-amber-500/30">
              <Shield className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-black tracking-tight text-amber-50 sm:text-2xl">
                Admin Console
              </h1>
              <p className="flex items-center gap-1.5 text-xs text-amber-200/55">
                <Radio className="h-3 w-3 animate-pulse text-equb-400" />
                ፈጣን እቁብ · wallets · Telebirr
              </p>
            </div>
          </div>
          <Link
            href="/rooms"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 py-2 text-xs font-medium text-white/55 transition hover:border-amber-500/40 hover:text-amber-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to app
          </Link>
        </div>

        <nav className="relative mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-black/50 p-1.5 backdrop-blur">
          {links.map(({ href, label, icon: Icon }) => {
            const active =
              href === '/admin' ? path === '/admin' : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition',
                  active
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-500/25'
                    : 'text-white/45 hover:bg-white/5 hover:text-white/85',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <AdminGuard>{children}</AdminGuard>
    </div>
  );
}
