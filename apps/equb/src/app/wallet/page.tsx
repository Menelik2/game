'use client';

import { useEqubStore } from '@/lib/store';
import Link from 'next/link';

export default function WalletPage() {
  const user = useEqubStore((s) => s.user);
  const history = useEqubStore((s) => s.history);
  const loginDemo = useEqubStore((s) => s.loginDemo);

  if (!user) {
    return (
      <div className="py-12 text-center">
        <p className="text-white/50">Sign in to see your wallet</p>
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
      {history && history.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-semibold">Draw results</h2>
          <ul className="mt-3 space-y-2">
            {history.slice(0, 15).map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex justify-between rounded-xl bg-black/30 px-3 py-2 text-xs">
                <span>#{h.winningNumber} · {h.wasYou ? 'You won' : h.winnerName}</span>
                <span className={h.wasYou ? 'font-semibold text-equb-400' : 'text-white/50'}>
                  {h.wasYou ? '+' : ''}{h.amount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href="/rooms" className="block text-center text-sm text-equb-400">Browse rooms →</Link>
    </div>
  );
}
