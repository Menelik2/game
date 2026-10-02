'use client';

import Link from 'next/link';
import { useEqubStore } from '@/lib/store';

export default function HomePage() {
  const user = useEqubStore((s) => s.user);
  const loginDemo = useEqubStore((s) => s.loginDemo);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="keno-title">FAST EQUB</h1>
          <p className="text-[11px] text-white/40">ፋስት እቁብ · pick · draw · one winner</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/40">Balance</p>
          <p className="font-mono text-sm font-bold text-equb-400">
            {user ? user.balance.toLocaleString() : '—'}
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="text-sm leading-relaxed text-white/70">
          Inspired by Ethiopian Equb circles. Everyone pays the same entry. The computer draws{' '}
          <span className="font-semibold text-gold-400">one number</span>. That player wins the full pot.
        </p>
      </div>

      {!user ? (
        <button
          type="button"
          onClick={() => loginDemo()}
          className="w-full rounded-2xl bg-gold-500 py-4 text-sm font-black text-black"
        >
          START · 5,000 VIRTUAL BIRR
        </button>
      ) : (
        <Link
          href="/rooms"
          className="block w-full rounded-2xl bg-gold-500 py-4 text-center text-sm font-black text-black"
        >
          PLAY ROOMS
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { t: '5–100', s: 'Seats' },
          { t: 'CSPRNG', s: 'Draw' },
          { t: '1 WIN', s: 'Winner' },
        ].map((x) => (
          <div key={x.s} className="glass rounded-xl py-3">
            <p className="text-sm font-black text-gold-400">{x.t}</p>
            <p className="text-[10px] text-white/40">{x.s}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gold-400/80">Rules</p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-[11px] text-white/55">
          <li>Select a room (group size & pot)</li>
          <li>Pick one unique number on the board</li>
          <li>Fill seats (friends or demo bots)</li>
          <li>Crypto draw → matching number wins pot</li>
        </ol>
      </div>
    </div>
  );
}
