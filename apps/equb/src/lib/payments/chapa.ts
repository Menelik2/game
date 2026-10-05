const CHAPA_BASE = 'https://api.chapa.co/v1';

export type ChapaInitResult = {
  checkoutUrl: string;
  txRef: string;
  providerStatus: string;
};

export async function chapaInitialize(params: {
  amount: number;
  currency: string;
  email: string;
  firstName: string;
  phone?: string;
  txRef: string;
  callbackUrl: string;
  returnUrl: string;
}): Promise<ChapaInitResult> {
  const key = process.env.CHAPA_SECRET_KEY;
  if (!key) throw new Error('CHAPA_SECRET_KEY not configured');

  const res = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: String(params.amount),
      currency: params.currency || 'ETB',
      email: params.email,
      first_name: params.firstName,
      phone_number: params.phone || undefined,
      tx_ref: params.txRef,
      callback_url: params.callbackUrl,
      return_url: params.returnUrl,
      customization: {
        title: 'Fast Equb',
        description: 'Wallet deposit',
      },
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status !== 'success') {
    throw new Error(json?.message || `Chapa init failed (${res.status})`);
  }

  const checkoutUrl = json?.data?.checkout_url as string;
  if (!checkoutUrl) throw new Error('Chapa did not return checkout_url');

  return {
    checkoutUrl,
    txRef: params.txRef,
    providerStatus: String(json.status),
  };
}

export async function chapaVerify(txRef: string): Promise<{
  status: 'success' | 'failed' | 'pending';
  amount?: number;
  currency?: string;
}> {
  const key = process.env.CHAPA_SECRET_KEY;
  if (!key) throw new Error('CHAPA_SECRET_KEY not configured');

  const res = await fetch(
    `${CHAPA_BASE}/transaction/verify/${encodeURIComponent(txRef)}`,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { status: 'pending' };
  const st = String(json?.data?.status || json?.status || '').toLowerCase();
  if (st === 'success') {
    return {
      status: 'success',
      amount: Number(json?.data?.amount),
      currency: String(json?.data?.currency || 'ETB'),
    };
  }
  if (st === 'failed' || st === 'cancelled') return { status: 'failed' };
  return { status: 'pending' };
}

export function chapaVerifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  const secret = process.env.CHAPA_WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;
  if (signature.length !== secret.length) return false;
  let ok = 0;
  for (let i = 0; i < secret.length; i++) {
    ok |= signature.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return ok === 0;
}
