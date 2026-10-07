/** Local phone auth fallback — no hardcoded admin password on the client */

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
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

export function getAccountById(userId: string): LocalAccount | null {
  return loadAccounts().find((a) => a.id === userId) || null;
}

export function getAccountBalance(userId: string): number | null {
  const a = getAccountById(userId);
  return a ? a.balance : null;
}

export function updateLocalBalance(userId: string, balance: number): boolean {
  const list = loadAccounts();
  const i = list.findIndex((a) => a.id === userId);
  if (i < 0) return false;
  const next = Math.max(0, Math.round(Number(balance) * 100) / 100);
  list[i] = { ...list[i]!, balance: next };
  saveAccounts(list);
  return true;
}

function namesMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  return norm(a) === norm(b);
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
    balance: 0,
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
  const phone = normalizePhone(input.phone);
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

export async function resetPasswordLocal(input: {
  phone: string;
  fullName: string;
  newPassword: string;
}): Promise<{ ok: true; account: LocalAccount } | { ok: false; error: string }> {
  const phone = normalizePhone(input.phone);
  if (!phone) return { ok: false, error: 'ትክክለኛ ስልክ ያስገቡ (09xxxxxxxx)' };

  const fullName = input.fullName.trim().replace(/\s+/g, ' ');
  if (fullName.length < 2) {
    return { ok: false, error: 'ሙሉ ስም ያስገቡ (ለማረጋገጥ)' };
  }
  if (!input.newPassword || input.newPassword.length < 6) {
    return { ok: false, error: 'አዲስ የይለፍ ቃል ቢያንስ 6 ቁምፊ' };
  }

  const list = loadAccounts();
  const i = list.findIndex((a) => a.phone === phone);
  if (i < 0) {
    return { ok: false, error: 'በዚህ ስልክ መለያ አልተገኘም' };
  }
  const account = list[i]!;
  if (account.banned) return { ok: false, error: 'መለያ ተከልክሏል' };
  if (!namesMatch(account.fullName, fullName)) {
    return { ok: false, error: 'ሙሉ ስም ከመለያ ጋር አይዛመድም' };
  }

  const passwordHash = await hashPassword(input.newPassword);
  list[i] = { ...account, passwordHash };
  saveAccounts(list);
  return { ok: true, account: list[i]! };
}

export function adminListAccounts(): LocalAccount[] {
  return loadAccounts();
}

export function adminSetBalance(
  userId: string,
  balance: number,
): { ok: boolean; balance?: number; message: string } {
  if (!Number.isFinite(balance) || balance < 0) {
    return { ok: false, message: 'Invalid balance' };
  }
  const next = Math.round(balance * 100) / 100;
  const ok = updateLocalBalance(userId, next);
  if (!ok) return { ok: false, message: 'User not found' };
  return { ok: true, balance: next, message: `Balance set to ${next}` };
}

export function adminAddBalance(
  userId: string,
  amount: number,
): { ok: boolean; balance?: number; message: string } {
  if (!Number.isFinite(amount) || amount === 0) {
    return { ok: false, message: 'Enter a non-zero amount' };
  }
  const a = getAccountById(userId);
  if (!a) return { ok: false, message: 'User not found' };
  const next = Math.max(0, Math.round((a.balance + amount) * 100) / 100);
  updateLocalBalance(userId, next);
  return {
    ok: true,
    balance: next,
    message: amount > 0 ? `Added ${amount} → ${next}` : `Adjusted ${amount} → ${next}`,
  };
}

export function adminSetBanned(userId: string, banned: boolean) {
  const list = loadAccounts();
  const i = list.findIndex((a) => a.id === userId);
  if (i < 0) return;
  list[i] = { ...list[i]!, banned };
  saveAccounts(list);
}

export function tryDebitAccount(
  userId: string,
  amount: number,
): { ok: true; balance: number } | { ok: false; message: string } {
  const a = getAccountById(userId);
  if (!a) {
    return { ok: true, balance: -1 };
  }
  if (a.balance < amount) {
    return { ok: false, message: `Need ${amount}, have ${a.balance}` };
  }
  const next = Math.round((a.balance - amount) * 100) / 100;
  updateLocalBalance(userId, next);
  return { ok: true, balance: next };
}

export function creditAccount(userId: string, amount: number): number | null {
  const a = getAccountById(userId);
  if (!a) return null;
  const next = Math.round((a.balance + amount) * 100) / 100;
  updateLocalBalance(userId, next);
  return next;
}
