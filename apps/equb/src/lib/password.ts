export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`equb-v1:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
