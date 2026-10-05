/** Operator Telebirr receive account — not a third-party checkout. */
export const TELEBIRR_PHONE = '0977832379';
export const TELEBIRR_NAME = 'Menelik';
export const TELEBIRR_PHONE_E164 = '+251977832379';

export type TelebirrClaim = {
  id: string;
  userId: string;
  phone: string;
  amount: number | null;
  txnRef: string;
  sms: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
};

const g = globalThis as unknown as { __tbClaims?: TelebirrClaim[] };
if (!g.__tbClaims) g.__tbClaims = [];

export function listClaims(userId?: string): TelebirrClaim[] {
  const all = g.__tbClaims || [];
  return userId ? all.filter((c) => c.userId === userId) : all;
}

export function saveClaim(c: TelebirrClaim) {
  g.__tbClaims!.unshift(c);
  if (g.__tbClaims!.length > 300) g.__tbClaims!.length = 300;
}

export function findClaim(id: string) {
  return g.__tbClaims?.find((c) => c.id === id);
}

export function updateClaim(id: string, status: TelebirrClaim['status']) {
  const c = findClaim(id);
  if (!c) return null;
  c.status = status;
  return c;
}

export function parseTelebirrSms(raw: string): {
  amount: number | null;
  txnRef: string;
} {
  const text = (raw || '').trim();
  const amountMatch =
    text.match(/(?:ETB|Birr|ብር)\s*([0-9]+(?:[.,][0-9]{1,2})?)/i) ||
    text.match(/([0-9]+(?:[.,][0-9]{1,2})?)\s*(?:ETB|Birr|ብር)/i) ||
    text.match(/(?:amount|መጠን)[:\s]*([0-9]+(?:[.,][0-9]{1,2})?)/i);
  const amount = amountMatch
    ? Number(amountMatch[1].replace(',', ''))
    : null;

  const txnMatch =
    text.match(/(?:transaction|txn|ref|receipt|ቁጥር)[:\s#]*([A-Z0-9]{6,})/i) ||
    text.match(/\b([A-Z]{2,}[0-9]{4,}|[0-9]{8,})\b/);
  const txnRef = txnMatch ? txnMatch[1] : text.replace(/\s+/g, '').slice(0, 40);

  return {
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    txnRef: txnRef || `sms_${Date.now().toString(36)}`,
  };
}
