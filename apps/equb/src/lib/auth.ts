/** Demo auth helpers (client-side). Not for real-money production. */

export type Role = 'player' | 'admin';

export type Account = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  balance: number;
  referralCode: string;
  referredBy?: string;
  role: Role;
  createdAt: number;
  banned?: boolean;
};

export const ADMIN_EMAIL = 'admin@equb.local';
export const ADMIN_PASSWORD = 'Admin123!';

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`equb-v1:${password}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 0;
  for (let i = 0; i < data.length; i++) h = (h * 31 + data[i]) | 0;
  return `fb_${h.toString(16)}`;
}

export function makeReferral(name: string) {
  return (
    name.slice(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X') +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

export function publicUser(a: Account) {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    balance: a.balance,
    referralCode: a.referralCode,
    referredBy: a.referredBy,
    role: a.role,
    banned: a.banned,
  };
}
