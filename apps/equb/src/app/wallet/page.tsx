'use client';

import { useEqubStore } from '@/lib/store';
import Link from 'next/link';

export default function WalletPage() {
  const user = useEqubStore((s) => s.user);
  const loginDemo = useEqubStore((s) => s.loginDemo);

  if (!user) {
    return (
      <div className="py-12 text-center">
        <p className="text-white/50">Sign in to see your virtual Birr wallet</p>
        <button
          onClick={() => loginDemo()}
          className="mt-4 rounded-full bg-equb-500 px-6 py-2 text-sm font-semibold"
        >
          Start demo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Wallet</h1>
      <div className="glass rounded-3xl p-6 text-center">
        <p className="text-xs text-white/40">Virtual Birr · Demo</p>
        <p className="mt-2 text-4xl font-black text-equb-400">{user.balance.toLocaleString()}</p>
        <p className="mt-1 text-sm text-white/50">Birr</p>
      </div>
      <p className="text-xs text-white/40">
        No real money, deposits, or withdrawals in demo mode.
      </p>
      <Link href="/rooms" className="block text-center text-sm text-equb-400">
        Browse rooms →
      </Link>
    </div>
  );
}
