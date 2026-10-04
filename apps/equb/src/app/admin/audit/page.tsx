'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { fetchAdminAudit } from '@/lib/admin-api';
import { isApiConfigured } from '@/lib/api';
import { AlertCircle, ScrollText } from 'lucide-react';

type AuditItem = {
  id: string;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  userId?: string | null;
  createdAt: string;
};

export default function AdminAuditPage() {
  const user = useEqubStore((s) => s.user);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = false;
    (async () => {
      if (!isApiConfigured()) {
        setLoading(false);
        setError('API not configured');
        return;
      }
      setLoading(true);
      try {
        const res = await fetchAdminAudit(page);
        if (!c) {
          setItems(res.items || []);
          setTotalPages(res.meta?.totalPages || 1);
        }
      } catch (e) {
        if (!c) setError(e instanceof Error ? e.message : 'Failed');
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [page]);

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
      <div className="flex items-center gap-2 text-sm text-white/50">
        <ScrollText className="h-4 w-4" />
        Security & operations audit trail
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-white/40">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-white/40">No audit events yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-amber-100">{a.action}</span>
                <span className="text-[11px] text-white/35">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/40">
                {a.entity || '—'} {a.entityId ? `· ${a.entityId.slice(0, 8)}…` : ''}
                {a.userId ? ` · user ${a.userId.slice(0, 8)}…` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-white/40">
            {page}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-white/10 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
