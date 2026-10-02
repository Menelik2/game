'use client';

import Link from 'next/link';
import { useEqubStore } from '@/lib/store';

export default function HomePage() {
  const user = useEqubStore((s) => s.user);
  const loginDemo = useEqubStore((s) => s.loginDemo);

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6 text-center">
        <h1 className="text-3xl font-black">Fast Equb</h1>
        <p className="mt-2 text-sm text-white/50">
          Pick a number · computer draws · one winner takes the pot
        </p>
        <p className="mt-1 text-xs text-equb-400">Inspired by Ethiopian traditional Equb</p>
      </div>

      {!user ? (
        <button
          onClick={() => loginDemo()}
          className="w-full rounded-2xl bg-equb-500 py-4 text-sm font-bold"
        >
          Start with 5,000 virtual Birr
        </button>
      ) : (
        <Link
          href="/rooms"
          className="block w-full rounded-2xl bg-equb-500 py-4 text-center text-sm font-bold"
        >
          Browse rooms
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 text-center text-xs">
        <div className="glass rounded-2xl p-4">
          <p className="text-2xl font-bold text-equb-400">5–100</p>
          <p className="text-white/40">Group sizes</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-2xl font-bold text-gold-400">CSPRNG</p>
          <p className="text-white/40">Fair draws</p>
        </div>
      </div>

      <ol className="space-y-2 text-sm text-white/60">
        <li>1. Join a room and pick a unique number</li>
        <li>2. Fill seats (friends or demo bots)</li>
        <li>3. Crypto draw picks one winner</li>
        <li>4. Winner receives the full pot</li>
      </ol>
    </div>
  );
}
