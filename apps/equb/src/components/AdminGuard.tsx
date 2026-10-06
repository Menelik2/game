'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Shield, AlertTriangle } from 'lucide-react';
import { useEqubStore, type User } from '@/lib/store';
import { loadSessionUser } from '@/lib/session';
import { apiRefreshUser, isDbUserId } from '@/lib/auth-api';

const ADMIN_PHONES = new Set([
  '+251900000000',
  '0900000000',
  '900000000',
  '251900000000',
  '+251918006053',
  '0918006053',
  '918006053',
  '251918006053',
]);

function normalizeDigits(p?: string) {
  return (p || '').replace(/\D/g, '');
}

/** True if role is admin OR known admin phone */
export function isAdminUser(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  const u = user as User;
  if (u.role === 'admin') return true;
  const d = normalizeDigits(u.phone);
  if (
    ADMIN_PHONES.has(u.phone || '') ||
    ADMIN_PHONES.has(d) ||
    d === '900000000' ||
    d.endsWith('900000000') ||
    d === '918006053' ||
    d.endsWith('918006053')
  ) {
    return true;
  }
  return false;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const me = useEqubStore((s) => s.user);
  const hydrated = useEqubStore((s) => s.hydrated);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      let user = useEqubStore.getState().user;
      if (!user) {
        const snap = loadSessionUser();
        if (snap?.id) {
          const restored: User = {
            id: snap.id,
            name: snap.name,
            phone: snap.phone,
            email: snap.email,
            balance: snap.balance,
            referralCode: snap.referralCode,
            role: snap.role,
            banned: snap.banned,
            referredBy: snap.referredBy,
          };
          if (isAdminUser(restored) && restored.role !== 'admin') {
            restored.role = 'admin';
          }
          setSessionUser(restored);
          user = restored;
        }
      }

      if (user && isDbUserId(user.id)) {
        try {
          const u = await apiRefreshUser(user.id);
          if (u && !cancelled) {
            const next: User = {
              id: u.id,
              name: u.fullName || user.name,
              phone: u.phone || user.phone,
              email: user.email,
              balance: typeof u.balance === 'number' ? u.balance : user.balance,
              referralCode: u.referralCode || user.referralCode,
              role: (u.role as 'admin' | 'player') || user.role,
              banned: u.banned,
              referredBy: user.referredBy,
            };
            if (isAdminUser(next)) next.role = 'admin';
            setSessionUser(next);
            user = next;
          }
        } catch {
          /* keep local */
        }
      }

      if (!cancelled) {
        const cur = useEqubStore.getState().user;
        if (cur && isAdminUser(cur) && cur.role !== 'admin') {
          setSessionUser({ ...cur, role: 'admin' });
        }
        setReady(true);
        if (!cur) {
          setDenied(true);
        } else if (!isAdminUser(cur)) {
          setDenied(true);
        } else {
          setDenied(false);
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [setSessionUser, hydrated]);

  if (!ready && !hydrated) {
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
          Sign in with an admin account to open the control room.
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
