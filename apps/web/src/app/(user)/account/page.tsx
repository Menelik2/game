'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function AccountPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-3xl font-bold">Account</h1>
      <div className="mt-8 glass space-y-4 rounded-2xl p-6">
        <div>
          <p className="text-xs text-white/50">Email</p>
          <p className="font-medium">{user.email}</p>
        </div>
        <div>
          <p className="text-xs text-white/50">Status</p>
          <p className="font-medium">{user.status}</p>
        </div>
        <div className="flex flex-col gap-2 pt-4">
          <Link href="/wallet" className="rounded-xl bg-white/5 px-4 py-3 text-sm hover:bg-white/10">Wallet</Link>
          <button onClick={() => logout().then(() => router.push('/'))}
            className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400 hover:bg-red-500/20">Log out</button>
        </div>
      </div>
    </div>
  );
}
