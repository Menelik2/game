/** Local phone auth helpers (demo / offline). Username = phone. */

export type LocalAccount = {
  id: string;
  fullName: string;
  phone: string;
  passwordHash: string;
  balance: number;
  referralCode: string;
  createdAt: number;
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
  if (!phone) return { ok: false, error: 'ትክክለኛ ስልክ ያስገቡ' };
  if (!input.password) return { ok: false, error: 'የይለፍ ቃል ያስገቡ' };

  const list = loadAccounts();
  const account = list.find((a) => a.phone === phone);
  if (!account) return { ok: false, error: 'ስልክ ወይም የይለፍ ቃል ትክክል አይደለም' };

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
