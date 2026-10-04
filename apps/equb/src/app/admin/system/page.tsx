'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { fetchAdminHealth } from '@/lib/admin-api';
import { isApiConfigured, getApiBase } from '@/lib/api';
import { AlertCircle, Server, Database, Shield } from 'lucide-react';

export default function AdminSystemPage() {
  const user = useEqubStore((s) => s.user);
  const [health, setHealth] = useState<{
    ok: boolean;
    database: string;
    demoMode: boolean;
    realMoneyEnabled: boolean;
    nodeEnv: string;
    timestamp: string;
  } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let c = false;
    (async () => {
      if (!isApiConfigured()) {
        setError('NEXT_PUBLIC_API_URL not set');
        return;
      }
      try {
        const h = await fetchAdminHealth();
        if (!c) setHealth(h);
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : 'Health check failed');
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  if (!user) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-400" />
        <Link href="/profile" className="mt-3 inline-block text-equb-400 underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-white/50">Infrastructure & runtime flags</p>

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-white/40">
            <Server className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase">API base</span>
          </div>
          <p className="mt-2 break-all font-mono text-sm text-equb-200">
            {getApiBase() || '—'}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-white/40">
            <Database className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase">Database</span>
          </div>
          <p className="mt-2 text-lg font-bold">
            {health ? (
              <span className={health.ok ? 'text-equb-300' : 'text-red-300'}>
                {health.database}
              </span>
            ) : (
              <span className="text-white/30">…</span>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-white/40">
            <Shield className="h-4 w-4" />
            <span className="text-[10px] font-semibold uppercase">Flags</span>
          </div>
          <ul className="mt-2 space-y-1 text-sm text-white/70">
            <li>ENV: {health?.nodeEnv || '—'}</li>
            <li>Demo mode: {health ? String(health.demoMode) : '—'}</li>
            <li>
              Real money:{' '}
              {health ? String(health.realMoneyEnabled) : '—'}
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="text-[10px] font-semibold uppercase text-white/40">Checked at</div>
          <p className="mt-2 text-sm text-white/60">
            {health?.timestamp
              ? new Date(health.timestamp).toLocaleString()
              : '—'}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-white/15 p-4 text-xs text-white/40">
        Full admin API requires login as a user with <code className="text-amber-200/80">isAdmin</code>.
        Seed admin phone <strong className="text-white/60">0918006053</strong> / password{' '}
        <strong className="text-white/60">Admin123!</strong> after running seed.
      </div>
    </div>
  );
}
