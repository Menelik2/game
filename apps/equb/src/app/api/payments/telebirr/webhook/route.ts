import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { verifyWebhookSignature } from '@/lib/telebirr/service';
import { creditFromWebhook } from '@/lib/wallet/deposits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const seen = new Set<string>();

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature =
    req.headers.get('x-telebirr-signature') || req.headers.get('x-signature');
  const valid = verifyWebhookSignature(raw, signature);
  if (!valid) {
    return NextResponse.json(
      { success: false, message: 'Invalid signature' },
      { status: 401 },
    );
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid payload' },
      { status: 400 },
    );
  }

  const eventId = String(
    payload.eventId || payload.transId || payload.merchOrderId || '',
  );
  const hash = createHash('sha256').update(raw).digest('hex');
  const dedupeKey = eventId || hash;

  if (seen.has(dedupeKey)) {
    return NextResponse.json({ success: true, duplicate: true });
  }

  const status = String(
    payload.tradeStatus || payload.status || '',
  ).toUpperCase();

  if (
    status !== 'SUCCESS' &&
    status !== 'COMPLETED' &&
    status !== 'PAY_SUCCESS'
  ) {
    seen.add(dedupeKey);
    return NextResponse.json({ success: true, ignored: true });
  }

  // Must await — creditFromWebhook is async
  const credited = await creditFromWebhook({
    merchantOrderId: String(
      payload.merchOrderId || payload.merchantOrderId || '',
    ),
    providerTransactionId: String(
      payload.transId || payload.transactionNumber || '',
    ),
    amount: Number(payload.totalAmount || payload.amount),
    currency: String(payload.currency || 'ETB'),
  });

  const ok = Boolean(credited?.ok);
  const message = String(credited?.message || '');

  if (ok) {
    seen.add(dedupeKey);
  }

  return NextResponse.json({ success: ok, message });
}
