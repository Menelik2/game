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

export type AdminAuditItem = {
  id: string;
  userId?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  createdAt: string;
};

export type AdminDashboard = {
  registeredUsers: number;
  activeUsers: number;
  suspendedUsers?: number;
  adminUsers?: number;
  activeGames: number;
  totalTransactions: number;
  transactionsLast24h: number;
  newUsersLast7d?: number;
  totalDemoBalance: number;
  demoMode: boolean;
  realMoneyEnabled?: boolean;
  signupsByDay?: { date: string; count: number }[];
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
  recentAudit?: AdminAuditItem[];
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

export async function fetchAdminHealth() {
  return adminFetch('/admin/health') as Promise<{
    ok: boolean;
    database: string;
    demoMode: boolean;
    realMoneyEnabled: boolean;
    nodeEnv: string;
    timestamp: string;
  }>;
}

export async function fetchAdminUsers(
  page = 1,
  q = '',
  status = '',
): Promise<{ items: AdminUser[]; meta: { page: number; total: number; totalPages: number } }> {
  const qs = new URLSearchParams({ page: String(page), limit: '20' });
  if (q) qs.set('q', q);
  if (status) qs.set('status', status);
  return adminFetch(`/admin/users?${qs}`) as Promise<{
    items: AdminUser[];
    meta: { page: number; total: number; totalPages: number };
  }>;
}

export async function fetchAdminUser(id: string) {
  return adminFetch(`/admin/users/${id}`);
}

export async function createAdminUser(body: {
  fullName: string;
  phone: string;
  password: string;
  isAdmin?: boolean;
  initialBalance?: number;
}) {
  return adminFetch('/admin/users', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateAdminUser(
  id: string,
  body: {
    fullName?: string;
    phone?: string;
    status?: string;
    isAdmin?: boolean;
    password?: string;
  },
) {
  return adminFetch(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function deleteAdminUser(id: string, hard = false) {
  return adminFetch(`/admin/users/${id}${hard ? '?hard=true' : ''}`, {
    method: 'DELETE',
  });
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

export async function setAdminFlag(id: string, isAdmin: boolean) {
  return adminFetch(`/admin/users/${id}/admin`, {
    method: 'PATCH',
    body: JSON.stringify({ isAdmin }),
  });
}

export async function creditUser(id: string, amount: number, note?: string) {
  return adminFetch(`/admin/users/${id}/credit`, {
    method: 'POST',
    body: JSON.stringify({ amount, note }),
  });
}

export async function fetchAdminAudit(page = 1): Promise<{
  items: AdminAuditItem[];
  meta: { page: number; total: number; totalPages: number };
}> {
  return adminFetch(`/admin/audit?page=${page}&limit=40`) as Promise<{
    items: AdminAuditItem[];
    meta: { page: number; total: number; totalPages: number };
  }>;
}

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
