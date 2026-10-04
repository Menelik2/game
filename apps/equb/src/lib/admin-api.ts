import { getApiBase } from './api';

function token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('equb_access_token');
}

async function adminFetch(path: string, init?: RequestInit) {
  const base = getApiBase();
  if (!base) throw new Error('API not configured');
  const t = token();
  const res = await fetch(`${base}/api${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers || {}),
    },
    credentials: 'include',
  });
  const text = await res.text();
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  if (!res.ok) {
    const b = body as { error?: { message?: string }; message?: string };
    throw new Error(b?.error?.message || b?.message || `HTTP ${res.status}`);
  }
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: unknown }).data;
  }
  return body;
}

export type AdminDashboard = {
  registeredUsers: number;
  activeUsers: number;
  activeGames: number;
  totalTransactions: number;
  transactionsLast24h: number;
  totalDemoBalance: number;
  demoMode: boolean;
  recentUsers: Array<{
    id: string;
    phone?: string | null;
    email: string;
    fullName?: string | null;
    status: string;
    isAdmin: boolean;
    createdAt: string;
  }>;
  recentTransactions: Array<{
    id: string;
    userId: string;
    type: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
  }>;
};

export type AdminUser = {
  id: string;
  email: string;
  phone?: string | null;
  fullName?: string | null;
  status: string;
  country?: string | null;
  isAdmin: boolean;
  balance: number;
  createdAt: string;
};

export async function fetchAdminDashboard(): Promise<AdminDashboard> {
  return adminFetch('/admin/dashboard') as Promise<AdminDashboard>;
}

export async function fetchAdminUsers(
  page = 1,
  q = '',
): Promise<{ items: AdminUser[]; meta: { page: number; total: number; totalPages: number } }> {
  const qs = new URLSearchParams({ page: String(page), limit: '20' });
  if (q) qs.set('q', q);
  return adminFetch(`/admin/users?${qs}`) as Promise<{
    items: AdminUser[];
    meta: { page: number; total: number; totalPages: number };
  }>;
}

export async function setAdminUserStatus(
  id: string,
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED',
) {
  return adminFetch(`/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/** Local offline admin snapshot from browser accounts */
export function localAdminSnapshot() {
  if (typeof window === 'undefined') {
    return { users: [] as Array<Record<string, unknown>>, total: 0 };
  }
  try {
    const raw = localStorage.getItem('equb-accounts-v1');
    const list = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
    return {
      users: list.map((a) => ({
        id: a.id,
        fullName: a.fullName,
        phone: a.phone,
        balance: a.balance,
        createdAt: a.createdAt
          ? new Date(a.createdAt as number).toISOString()
          : null,
      })),
      total: list.length,
    };
  } catch {
    return { users: [], total: 0 };
  }
}
