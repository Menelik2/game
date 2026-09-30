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
        <p className="text-sm text-white/50">Create a demo profile to play Fast Equb</p>
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
      <div className="glass rounded-3xl space-y-2 p-5 text-sm">
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
          <span className="text-white/40">Your invite code</span>
          <br />
          <strong className="font-mono tracking-widest">{user.referralCode}</strong>
        </p>
        <p>
          <span className="text-white/40">Mode</span>
          <br />
          <strong className={live ? 'text-equb-400' : 'text-white/70'}>
            {live ? 'LIVE multiplayer' : 'Solo demo (this device)'}
          </strong>
        </p>
      </div>
      {!user.referredBy && (
        <div className="glass rounded-3xl p-5">
          <h2 className="font-semibold">Have an invite code?</h2>
          <p className="text-xs text-white/40">Get +100 virtual Birr once</p>
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
      <div className="glass rounded-3xl p-5 text-xs text-white/50">
        <p className="font-semibold text-white/80">How to enable live multiplayer</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Deploy NestJS API (apps/api) to Render or Railway</li>
          <li>
            Vercel → Project Settings → Environment Variables → add{' '}
            <code className="text-equb-400">NEXT_PUBLIC_API_URL</code> ={' '}
            <code className="text-equb-400">https://your-api.onrender.com</code>
          </li>
          <li>Redeploy the frontend</li>
        </ol>
        <p className="mt-2">Until then, solo demo is fully playable with bots.</p>
      </div>
      <button
        onClick={() => logout()}
        className="w-full rounded-xl border border-white/10 py-3 text-sm text-white/50"
      >
        Sign out
      </button>
    </div>
  );
}
