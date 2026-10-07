import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Server-side password hash.
 * Uses optional PASSWORD_PEPPER env for extra secret material.
 * (Migrating to Argon2/bcrypt is recommended for a later release.)
 */
export function hashPassword(password: string): string {
  const pepper = process.env.PASSWORD_PEPPER || 'equb-v1';
  return createHash('sha256')
    .update(`${pepper}:${password}`, 'utf8')
    .digest('hex');
}

export async function hashPasswordAsync(password: string): Promise<string> {
  return hashPassword(password);
}

/** Constant-time compare of two hex hashes. */
export function safeEqualHash(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
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
