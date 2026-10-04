/** Local phone auth helpers (demo / offline). Username = phone. */

export type Role = 'player' | 'admin';

export type LocalAccount = {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  passwordHash: string;
  balance: number;
  referralCode: string;
  createdAt: number;
  role?: Role;
  banned?: boolean;
};

export const ADMIN_EMAIL = 'admin@equb.local';
export const ADMIN_PASSWORD = 'Admin123!';
export const ADMIN_PHONE = '+251900000000';

const ACCOUNTS_KEY = 'equb-accounts-v1';

export function normalizePhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  let n = digits;
  if (n.startsWith('251') && n.length === 12) n = n.slice(3);
  if (n.startsWith('0') && n.length === 10) n = n.slice(1);
  if (n.length === 9 && n.startsWith('9')) return `+251${n}`;
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`equb-v1:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function loadAccounts(): LocalAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as LocalAccount[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveAccounts(list: LocalAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

export async function registerLocal(input: {
  fullName: string;
  phone: string;
  password: string;
}): Promise<{ ok: true; account: LocalAccount } | { ok: false; error: string }> {
  const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  if (fullName.length < 2) return { ok: false, error: 'ሙሉ ስም ያስገቡ (ቢያንስ 2 ፊደል)' };

  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: 'ትክክለኛ ስልክ (09xxxxxxxx ወይም +2519...)' };

  if (!input.password || input.password.length < 6) {
    return { ok: false, error: 'የይለፍ ቃል ቢያንስ 6 ቁምፊ' };
  }

  const list = loadAccounts();
  if (list.some((a) => a.phone === phone)) {
    return { ok: false, error: 'ይህ ስልክ ቁጥር አስቀድሞ ተመዝግቧል' };
  }

  const passwordHash = await hashPassword(input.password);
  const account: LocalAccount = {
    id: `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    fullName,
    phone,
    passwordHash,
    balance: 5000,
    referralCode:
      fullName.slice(0, 3).toUpperCase().replace(/\s/g, '') +
      Math.random().toString(36).slice(2, 6).toUpperCase(),
    createdAt: Date.now(),
    role: 'player',
  };
  list.push(account);
  saveAccounts(list);
  return { ok: true, account };
}

export async function loginLocal(input: {
  phone: string;
  password: string;
}): Promise<{ ok: true; account: LocalAccount } | { ok: false; error: string }> {
  await ensureAdminAccount();
  let phone = normalizePhone(input.phone);
  if (!phone && input.phone.trim() === ADMIN_PHONE) phone = ADMIN_PHONE;
  if (!phone && input.phone.replace(/\s/g, '') === '0900000000') phone = ADMIN_PHONE;
  if (!phone) return { ok: false, error: 'ትክክለኛ ስልክ ያስገቡ (09xxxxxxxx)' };
  if (!input.password) return { ok: false, error: 'የይለፍ ቃል ያስገቡ' };

  const list = loadAccounts();
  const account = list.find((a) => a.phone === phone);
  if (!account) return { ok: false, error: 'ስልክ ወይም የይለፍ ቃል ትክክል አይደለም' };
  if (account.banned) return { ok: false, error: 'መለያ ተከልክሏል / Account banned' };

  const passwordHash = await hashPassword(input.password);
  if (passwordHash !== account.passwordHash) {
    return { ok: false, error: 'ስልክ ወይም የይለፍ ቃል ትክክል አይደለም' };
  }
  return { ok: true, account };
}

export function updateLocalBalance(userId: string, balance: number) {
  const list = loadAccounts();
  const i = list.findIndex((a) => a.id === userId);
  if (i >= 0) {
    list[i] = { ...list[i]!, balance };
    saveAccounts(list);
  }
}

export async function ensureAdminAccount(): Promise<void> {
  const list = loadAccounts();
  if (list.some((a) => a.role === 'admin' || a.email === ADMIN_EMAIL || a.phone === ADMIN_PHONE)) {
    return;
  }
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  list.push({
    id: 'admin_seed',
    fullName: 'Admin',
    phone: ADMIN_PHONE,
    email: ADMIN_EMAIL,
    passwordHash,
    balance: 1_000_000,
    referralCode: 'ADMIN001',
    createdAt: Date.now(),
    role: 'admin',
  });
  saveAccounts(list);
}

export async function registerEmail(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<{ ok: true; account: LocalAccount } | { ok: false; error: string }> {
  return registerLocal({
    fullName: input.fullName,
    phone: input.email,
    password: input.password,
  });
}

export async function loginEmail(input: {
  email: string;
  password: string;
}): Promise<{ ok: true; account: LocalAccount } | { ok: false; error: string }> {
  return loginLocal({ phone: input.email, password: input.password });
}

export function adminListAccounts(): LocalAccount[] {
  return loadAccounts();
}

export function adminSetBalance(userId: string, balance: number) {
  updateLocalBalance(userId, balance);
  return { ok: true, balance, message: `Balance set to ${balance}` };
}

export function adminAddBalance(userId: string, amount: number) {
  const list = loadAccounts();
  const i = list.findIndex((a) => a.id === userId);
  if (i < 0) return { ok: false, message: 'User not found' };
  const next = Math.max(0, Math.round((list[i]!.balance + amount) * 100) / 100);
  list[i] = { ...list[i]!, balance: next };
  saveAccounts(list);
  return { ok: true, balance: next, message: `Balance updated to ${next}` };
}

export function adminSetBanned(userId: string, banned: boolean) {
  const list = loadAccounts();
  const i = list.findIndex((a) => a.id === userId);
  if (i < 0) return;
  list[i] = { ...list[i]!, banned };
  saveAccounts(list);
}
