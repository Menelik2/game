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
  if (ADMIN_PHONES.has(d) || d === '900000000' || d.endsWith('900000000')) {
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

  // Restore session + refresh role from API before any redirect
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // 1) Pull from equb_session_user_v1 if store empty
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
          // Promote known admin phone
          if (isAdminUser(restored) && restored.role !== 'admin') {
            restored.role = 'admin';
          }
          setSessionUser(restored);
          user = restored;
        }
      }

      // 2) Refresh role from DB for UUID users
      if (user && isDbUserId(user.id)) {
        try {
          const u = await apiRefreshUser(user.id);
          if (u && !cancelled) {
            const next: User = {
              id: u.id,
              name: u.fullName,
              phone: u.phone,
              email: `${u.phone}@phone.equb`,
              balance: u.balance,
              referralCode: u.referralCode,
              role: (u.role as 'player' | 'admin') || user.role,
              banned: u.banned,
            };
            if (isAdminUser(next) && next.role !== 'admin') {
              next.role = 'admin';
            }
            setSessionUser(next);
            user = next;
          }
        } catch {
          /* keep local session */
        }
      }

      // 3) Force role=admin for known admin phone stuck as player
      const cur = useEqubStore.getState().user;
      if (cur && isAdminUser(cur) && cur.role !== 'admin') {
        setSessionUser({ ...cur, role: 'admin' });
      }

      if (!cancelled) {
        useEqubStore.setState({ hydrated: true });
        setReady(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [setSessionUser]);

  useEffect(() => {
    if (!ready && !hydrated) return;
    const user = useEqubStore.getState().user;
    if (!user) {
      setDenied(false);
      return;
    }
    if (!isAdminUser(user)) {
      setDenied(true);
      // Soft delay so we never flash-redirect during hydration races
      const t = window.setTimeout(() => {
        if (!isAdminUser(useEqubStore.getState().user)) {
          router.replace('/profile');
        }
      }, 400);
      return () => window.clearTimeout(t);
    }
    setDenied(false);
  }, [ready, hydrated, me, router]);

  if (!ready && !hydrated) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 py-16 text-center">
        <Shield className="mx-auto h-8 w-8 animate-pulse text-amber-400/60" />
        <p className="mt-3 text-sm text-white/45">Loading admin session…</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/40 py-16 text-center">
        <Shield className="mx-auto h-10 w-10 text-amber-400/50" />
        <p className="mt-3 text-sm text-white/50">Sign in as admin to continue</p>
        <p className="mt-1 font-mono text-xs text-white/35">
          0900000000 · Admin123!
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-full bg-amber-400 px-5 py-2 text-sm font-bold text-black"
        >
          Go to login
        </Link>
      </div>
    );
  }

  if (denied || !isAdminUser(me)) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 py-16 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-400" />
        <p className="mt-3 text-sm text-red-200">Admin access only</p>
        <p className="mt-1 text-xs text-white/40">
          Signed in as {me.name || me.phone} ({me.role || 'player'})
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block text-sm text-amber-300 underline"
        >
          Switch account
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
