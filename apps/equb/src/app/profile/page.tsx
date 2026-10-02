'use client';

import { useState } from 'react';
import { useEqubStore } from '@/lib/store';
import { setPlayerName, isMultiplayerEnabled } from '@/lib/multiplayer';

export default function ProfilePage() {
  const user = useEqubStore((s) => s.user);
  const loginDemo = useEqubStore((s) => s.loginDemo);
  const logout = useEqubStore((s) => s.logout);
  const claimReferral = useEqubStore((s) => s.claimReferral);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const live = typeof window !== 'undefined' && isMultiplayerEnabled();

  if (!user) {
    return (
      <div className="space-y-4 py-8">
        <h1 className="text-2xl font-bold">Welcome</h1>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-xl border border-white/10 bg-surface-800 px-4 py-3 text-sm"
        />
        <button
          onClick={() => {
            if (name) setPlayerName(name);
            loginDemo(name || undefined);
          }}
          className="w-full rounded-2xl bg-equb-500 py-3.5 text-sm font-bold"
        >
          Enter with 5,000 virtual Birr
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="glass space-y-2 rounded-3xl p-5 text-sm">
        <p>
          <span className="text-white/40">Name</span>
          <br />
          <strong>{user.name}</strong>
        </p>
        <p>
          <span className="text-white/40">Balance</span>
          <br />
          <strong className="text-equb-400">{user.balance.toLocaleString()} Birr</strong>
        </p>
        <p>
          <span className="text-white/40">Invite code</span>
          <br />
          <strong className="font-mono tracking-widest">{user.referralCode}</strong>
        </p>
        <p>
          <span className="text-white/40">Mode</span>
          <br />
          <strong>{live ? 'LIVE multiplayer' : 'Solo demo'}</strong>
        </p>
      </div>
      {!user.referredBy && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-semibold">Invite code?</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CODE"
              className="flex-1 rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm uppercase"
            />
            <button
              onClick={() => setMsg(claimReferral(code).message)}
              className="rounded-xl bg-equb-600 px-4 text-sm font-semibold"
            >
              Apply
            </button>
          </div>
          {msg && <p className="mt-2 text-xs text-equb-300">{msg}</p>}
        </div>
      )}
      <button onClick={() => logout()} className="w-full rounded-xl border border-white/10 py-3 text-sm text-white/50">
        Sign out
      </button>
    </div>
  );
}
