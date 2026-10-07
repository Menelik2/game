import type { PaymentTransaction } from './types';

export type { PaymentTransaction };

const g = globalThis as unknown as {
  __payTx?: Map<string, PaymentTransaction>;
};
if (!g.__payTx) g.__payTx = new Map();
const byId = g.__payTx;

export function saveTx(t: PaymentTransaction) {
  byId.set(t.id, t);
}

export function getTx(id: string): PaymentTransaction | undefined {
  return byId.get(id);
}

export function getTxByProviderRef(ref: string): PaymentTransaction | undefined {
  for (const t of byId.values()) {
    if (t.providerRef === ref) return t;
  }
  return undefined;
}

export function listTxForUser(userId: string): PaymentTransaction[] {
  return [...byId.values()]
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateTx(
  id: string,
  patch: Partial<PaymentTransaction>,
): PaymentTransaction | undefined {
  const cur = byId.get(id);
  if (!cur) return undefined;
  const next = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  byId.set(id, next);
  return next;
}
