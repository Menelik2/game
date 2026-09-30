'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useEqubStore } from '@/lib/store';
import { GROUP_SIZES, contributionPerMember } from '@/lib/equb-math';
import { ArrowRight, Users, Dices, Gift } from 'lucide-react';

export default function HomePage() {
  const user = useEqubStore((s) => s.user);
  const ensureRooms = useEqubStore((s) => s.ensureRooms);
  const loginDemo = useEqubStore((s) => s.loginDemo);

  useEffect(() => {
    ensureRooms();
  }, [ensureRooms]);

  return (
    <div className="space-y-6">
      <section className="glass rounded-3xl p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-equb-400">
          Fast Equb · Number draw
        </p>
        <h1 className="mt-2 text-3xl font-black leading-tight">
          Pick a number.
          <br />
          <span className="text-equb-400">One winner.</span>
        </h1>
        <p className="mt-3 text-sm text-white/60">
          Join a group, choose a unique number, pay the same entry. The computer draws one number —
          only that player wins the full pot.
        </p>
        {!user ? (
          <button
            onClick={() => loginDemo()}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-equb-500 to-equb-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-equb-500/25"
          >
            Start demo · 5,000 virtual Birr
          </button>
        ) : (
          <Link
            href="/rooms"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-equb-500 to-equb-600 py-3.5 text-sm font-bold shadow-lg shadow-equb-500/25"
          >
            Browse rooms <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </section>
      <section className="grid grid-cols-3 gap-2">
        {[
          { icon: Users, t: 'Groups', d: '5 → 100' },
          { icon: Dices, t: 'One winner', d: 'Computer draw' },
          { icon: Gift, t: 'Referrals', d: '+100 Birr' },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="glass rounded-2xl p-3 text-center">
            <Icon className="mx-auto h-5 w-5 text-equb-400" />
            <p className="mt-1 text-xs font-semibold">{t}</p>
            <p className="text-[10px] text-white/40">{d}</p>
          </div>
        ))}
      </section>
      <section className="glass rounded-3xl p-5">
        <h2 className="font-bold">Entry fee</h2>
        <p className="mt-1 text-xs text-white/50">entry = pot ÷ players</p>
        <div className="mt-4 space-y-2">
          {[
            { size: 5, pot: 500 },
            { size: 10, pot: 500 },
            { size: 20, pot: 1000 },
            { size: 50, pot: 5000 },
          ].map(({ size, pot }) => (
            <div
              key={`${size}-${pot}`}
              className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2 text-xs"
            >
              <span>
                {size} players · {pot.toLocaleString()} pot
              </span>
              <span className="font-semibold text-equb-400">
                {contributionPerMember(pot, size)} each
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-white/40">Group sizes: {GROUP_SIZES.join(', ')}</p>
      </section>
    </div>
  );
}
