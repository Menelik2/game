'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, AlertTriangle } from 'lucide-react';
import { useEqubStore, type User } from '@/lib/store';
import { apiRefreshUser } from '@/lib/auth-api';

/** Role from server session only — never elevate from local phone list. */
export function isAdminUser(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  const u = user as User;
  return String(u.role || '').toLowerCase() === 'admin';
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useEqubStore((s) => s.user);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // Always resolve from httpOnly session cookie
      const u = await apiRefreshUser();
      if (cancelled) return;

      if (!u) {
        setDenied(true);
        setReady(true);
        return;
      }

      const next: User = {
        id: u.id,
        name: u.fullName || 'Admin',
        phone: u.phone,
        email: `${(u.phone || '').replace('+', '')}@phone.equb`,
        balance: Number(u.balance) || 0,
        referralCode: u.referralCode || '',
        role: u.role === 'admin' ? 'admin' : 'player',
        banned: u.banned,
      };
      setSessionUser(next);

      if (next.role !== 'admin') {
        setDenied(true);
      } else {
        setDenied(false);
      }
      setReady(true);
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [setSessionUser]);

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/40">
        Loading admin…
      </div>
    );
  }

  if (denied || !me || !isAdminUser(me)) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-8 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-400" />
        <h1 className="text-lg font-bold">Admin only</h1>
        <p className="text-sm text-white/50">
          Sign in with an administrator account. Role is checked on the server
          via your session cookie.
        </p>
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-black"
        >
          <Shield className="h-4 w-4" /> Sign in
        </Link>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="block w-full text-sm text-white/40 underline"
        >
          Back home
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
