'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import {
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  creditUser,
  localAdminSnapshot,
  type AdminUser,
} from '@/lib/admin-api';
import { isApiConfigured } from '@/lib/api';
import {
  Search,
  AlertCircle,
  Download,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';

function exportCsv(rows: AdminUser[]) {
  const header = ['id', 'fullName', 'phone', 'email', 'status', 'isAdmin', 'balance', 'createdAt'];
  const lines = [
    header.join(','),
    ...rows.map((u) =>
      [
        u.id,
        JSON.stringify(u.fullName || ''),
        JSON.stringify(u.phone || ''),
        JSON.stringify(u.email || ''),
        u.status,
        u.isAdmin,
        u.balance,
        u.createdAt,
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `equb-users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type FormMode = 'create' | 'edit' | null;

export default function AdminUsersPage() {
  const session = useEqubStore((s) => s.user);
  const [items, setItems] = useState<AdminUser[]>([]);
  const [local, setLocal] = useState(localAdminSnapshot());
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creditAmt, setCreditAmt] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    password: '',
    isAdmin: false,
    status: 'ACTIVE',
    initialBalance: '5000',
  });
  const [formBusy, setFormBusy] = useState(false);

  const load = useCallback(async () => {
    setLocal(localAdminSnapshot());
    if (!isApiConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminUsers(page, q, status);
      setItems(res.items || []);
      setTotalPages(res.meta?.totalPages || 1);
      setTotal(res.meta?.total || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setFormMode('create');
    setEditId(null);
    setForm({
      fullName: '',
      phone: '',
      password: '',
      isAdmin: false,
      status: 'ACTIVE',
      initialBalance: '5000',
    });
    setError('');
  };

  const openEdit = (u: AdminUser) => {
    setFormMode('edit');
    setEditId(u.id);
    setForm({
      fullName: u.fullName || '',
      phone: u.phone || '',
      password: '',
      isAdmin: u.isAdmin,
      status: u.status || 'ACTIVE',
      initialBalance: '',
    });
    setError('');
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormBusy(true);
    setError('');
    setOkMsg('');
    try {
      if (formMode === 'create') {
        await createAdminUser({
          fullName: form.fullName,
          phone: form.phone,
          password: form.password,
          isAdmin: form.isAdmin,
          initialBalance: parseFloat(form.initialBalance) || 0,
        });
        setOkMsg('User created');
      } else if (formMode === 'edit' && editId) {
        await updateAdminUser(editId, {
          fullName: form.fullName,
          phone: form.phone,
          status: form.status,
          isAdmin: form.isAdmin,
          ...(form.password.length >= 6 ? { password: form.password } : {}),
        });
        setOkMsg('User updated');
      }
      setFormMode(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setFormBusy(false);
    }
  };

  const onDelete = async (id: string, hard = false) => {
    const msg = hard
      ? 'Permanently delete this user? This cannot be undone.'
      : 'Close this account (soft delete)?';
    if (!confirm(msg)) return;
    setBusyId(id);
    setError('');
    try {
      await deleteAdminUser(id, hard);
      setOkMsg(hard ? 'User deleted' : 'User closed');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  };

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  const onCredit = async (id: string) => {
    const amount = parseFloat(creditAmt[id] || '0');
    if (!amount || amount <= 0) return;
    setBusyId(id);
    try {
      await creditUser(id, amount, 'Admin console credit');
      setCreditAmt((c) => ({ ...c, [id]: '' }));
      setOkMsg(`Credited ${amount}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Credit failed');
    } finally {
      setBusyId(null);
    }
  };

  if (!session) {
    return (
      <div className="rounded-3xl border border-white/10 p-10 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-amber-400" />
        <p className="mt-3 text-sm text-white/60">Sign in required</p>
        <Link href="/profile" className="mt-3 inline-block text-equb-400 underline">
          Profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/45">
          {total > 0 ? `${total} users` : 'User directory'} · Full CRUD
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-black shadow shadow-amber-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            Create user
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 hover:bg-white/5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => exportCsv(items)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Create / Edit modal */}
      {formMode && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-surface-900 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">
                {formMode === 'create' ? 'Create user' : 'Edit user'}
              </h2>
              <button
                type="button"
                onClick={() => setFormMode(null)}
                className="rounded-full p-1.5 text-white/40 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={submitForm} className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-white/45">Full name</label>
                <input
                  required
                  minLength={2}
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-white/45">Phone</label>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="09xxxxxxxx"
                  className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-white/45">
                  Password {formMode === 'edit' ? '(leave blank to keep)' : ''}
                </label>
                <input
                  type="password"
                  required={formMode === 'create'}
                  minLength={formMode === 'create' ? 6 : undefined}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
                />
              </div>
              {formMode === 'edit' && (
                <div>
                  <label className="mb-1 block text-[11px] text-white/45">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              )}
              {formMode === 'create' && (
                <div>
                  <label className="mb-1 block text-[11px] text-white/45">Initial balance</label>
                  <input
                    type="number"
                    min={0}
                    value={form.initialBalance}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, initialBalance: e.target.value }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-surface-800 px-3 py-2.5 text-sm"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={form.isAdmin}
                  onChange={(e) => setForm((f) => ({ ...f, isAdmin: e.target.checked }))}
                  className="rounded"
                />
                Admin access
              </label>
              <button
                type="submit"
                disabled={formBusy}
                className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-black disabled:opacity-50"
              >
                {formBusy ? '…' : formMode === 'create' ? 'Create' : 'Save changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            load();
          }}
          className="flex min-w-[220px] flex-1 gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search phone or email…"
              className="w-full rounded-xl border border-white/10 bg-surface-800/90 py-2.5 pl-10 pr-3 text-sm outline-none ring-amber-500/30 focus:ring-2"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-white/10 px-4 text-sm font-semibold text-white"
          >
            Search
          </button>
        </form>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-white/10 bg-surface-800 px-3 py-2 text-sm"
        >
          <option value="">All status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {okMsg && (
        <div className="rounded-2xl border border-equb-500/30 bg-equb-500/10 px-4 py-2 text-xs text-equb-200">
          {okMsg}
        </div>
      )}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-3">
          {items.map((u) => (
            <div
              key={u.id}
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-equb-400 to-equb-700 text-lg font-black text-black">
                    {(u.fullName || u.phone || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white">{u.fullName || '—'}</p>
                    <button
                      type="button"
                      onClick={() => copyText(u.phone || u.email, u.id)}
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-white/50 hover:text-amber-200"
                    >
                      {u.phone || u.email}
                      {copied === u.id ? (
                        <Check className="h-3 w-3 text-equb-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <p className="mt-1 text-[11px] text-white/30">
                      {new Date(u.createdAt).toLocaleString()}
                      {u.isAdmin ? (
                        <span className="ml-2 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                          ADMIN
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black tabular-nums text-amber-200">
                    {Number(u.balance || 0).toLocaleString()}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      u.status === 'ACTIVE'
                        ? 'bg-equb-500/20 text-equb-300'
                        : u.status === 'CLOSED'
                          ? 'bg-white/10 text-white/40'
                          : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {u.status}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                <button
                  type="button"
                  onClick={() => openEdit(u)}
                  className="inline-flex items-center gap-1 rounded-xl border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/70"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => onDelete(u.id, false)}
                  className="inline-flex items-center gap-1 rounded-xl border border-red-500/30 px-3 py-1.5 text-[11px] font-semibold text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                  Close
                </button>
                <button
                  type="button"
                  disabled={busyId === u.id}
                  onClick={() => onDelete(u.id, true)}
                  className="rounded-xl border border-red-500/50 px-2 py-1.5 text-[10px] text-red-400/80"
                >
                  Hard delete
                </button>
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    placeholder="Amount"
                    value={creditAmt[u.id] || ''}
                    onChange={(e) =>
                      setCreditAmt((c) => ({ ...c, [u.id]: e.target.value }))
                    }
                    className="w-24 rounded-xl border border-white/10 bg-surface-800 px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => onCredit(u.id)}
                    className="rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-black"
                  >
                    + Credit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="mb-2 text-sm font-bold">No API users</h2>
          <p className="text-xs text-white/40">
            Create a user with the button above, or check local accounts.
          </p>
          {local.users.length > 0 && (
            <ul className="mt-3 divide-y divide-white/5 text-sm">
              {local.users.map((u) => (
                <li key={String(u.id)} className="flex justify-between py-2.5">
                  <span>
                    {String(u.fullName)}{' '}
                    <span className="font-mono text-xs text-white/40">{String(u.phone)}</span>
                  </span>
                  <span className="text-amber-300">{String(u.balance)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-xl border border-white/10 px-4 py-1.5 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-white/40">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border border-white/10 px-4 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
