import { createHash, randomBytes } from 'crypto';

/** Deterministic password hash (Node crypto — Vercel Node runtime) */
export function hashPassword(password: string): string {
  return createHash('sha256')
    .update(`equb-v1:${password}`, 'utf8')
    .digest('hex');
}

export async function hashPasswordAsync(password: string): Promise<string> {
  return hashPassword(password);
}

export function normalizePhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  let n = digits;
  if (n.startsWith('251')) n = n.slice(3);
  if (n.startsWith('0')) n = n.slice(1);
  if (n.length === 9 && n.startsWith('9')) return `+251${n}`;
  if (digits.length === 12 && digits.startsWith('2519')) return `+${digits}`;
  if (digits.length === 10 && digits.startsWith('09')) {
    return `+251${digits.slice(1)}`;
  }
  return null;
}

export function newId(): string {
  return randomBytes(16)
    .toString('hex')
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}
