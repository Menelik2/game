'use client';

import { useState } from 'react';
import { useEqubStore } from '@/lib/store';
import Link from 'next/link';
import { verifyDrawProof } from '@/lib/crypto-rng';

export default function WalletPage() {
  const user = useEqubStore((s) => s.user);
  const history = useEqubStore((s) => s.history);
  const loginDemo = useEqubStore((s) => s.loginDemo);
  const [verifyMsg, setVerifyMsg] = useState<Record<number, string>>({});

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
        <p className="mt-2 text-4xl font-black text-equb-400">
          {user.balance.toLocaleString()}
        </p>
        <p className="mt-1 text-sm text-white/50">Birr</p>
      </div>

      {history && history.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-semibold">Draw results</h2>
          <p className="mt-1 text-[10px] text-white/40">
            CSPRNG · rejection sampling · SHA-256 proof
          </p>
          <ul className="mt-3 space-y-3">
            {history.slice(0, 15).map((h, i) => (
              <li key={`${h.at}-${i}`} className="rounded-xl bg-black/30 px-3 py-2 text-xs">
                <div className="flex justify-between">
                  <span>
                    #{h.winningNumber} · {h.wasYou ? 'You won' : h.winnerName}
                  </span>
                  <span className={h.wasYou ? 'font-semibold text-equb-400' : 'text-white/50'}>
                    {h.wasYou ? '+' : ''}
                    {h.amount.toLocaleString()}
                  </span>
                </div>
                {h.commitmentHash && h.entropyHex && h.groupSize ? (
                  <div className="mt-1 space-y-1">
                    <p className="break-all font-mono text-[9px] text-white/30">
                      {h.commitmentHash.slice(0, 32)}…
                    </p>
                    <button
                      className="text-[10px] text-equb-400 underline"
                      onClick={async () => {
                        const ok = await verifyDrawProof({
                          winningNumber: h.winningNumber,
                          entropyHex: h.entropyHex!,
                          commitmentHash: h.commitmentHash!,
                          groupSize: h.groupSize!,
                          drawnAt: h.at,
                        });
                        setVerifyMsg((m) => ({
                          ...m,
                          [i]: ok ? 'Proof valid ✓' : 'Proof invalid',
                        }));
                      }}
                    >
                      Verify proof
                    </button>
                    {verifyMsg[i] && (
                      <p className="text-[10px] text-equb-300">{verifyMsg[i]}</p>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/rooms" className="block text-center text-sm text-equb-400">
        Browse rooms →
      </Link>
    </div>
  );
}
