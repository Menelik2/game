'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Wallet, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function Header() {
  const { user, token, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: wallet } = useQuery({
    queryKey: ['wallet'],
    queryFn: () => api<{ availableBalance: number }>('/wallet', { token: token! }),
    enabled: !!token,
  });

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-surface-900/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-apex-500 to-apex-700 shadow-glow">
            <span className="text-lg font-black text-white">A</span>
          </div>
          <span className="hidden text-xl font-bold sm:block">
            Apex<span className="text-apex-400">Casino</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/" className="text-sm text-white/70 hover:text-white">Home</Link>
          <Link href="/games" className="text-sm text-white/70 hover:text-white">Games</Link>
          <Link href="/promotions" className="text-sm text-white/70 hover:text-white">Promotions</Link>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/wallet" className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm">
                <Wallet className="h-4 w-4 text-gold-400" />
                <span>{wallet ? wallet.availableBalance.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'} <span className="text-white/50 text-xs">DEMO</span></span>
              </Link>
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)} className="flex h-9 w-9 items-center justify-center rounded-full bg-apex-600 text-sm font-bold">
                  {user.email[0].toUpperCase()}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-surface-800 py-2 shadow-xl">
                    <Link href="/account" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5" onClick={() => setMenuOpen(false)}>
                      <User className="h-4 w-4" /> Account
                    </Link>
                    <button onClick={() => { logout(); setMenuOpen(false); }} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-white/5">
                      <LogOut className="h-4 w-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="rounded-full px-4 py-2 text-sm text-white/80">Log in</Link>
              <Link href="/register" className="rounded-full bg-gradient-to-r from-apex-500 to-apex-600 px-4 py-2 text-sm font-semibold shadow-glow">Register</Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
