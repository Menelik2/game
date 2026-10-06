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
    payload = JSON.parse(raw);
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
  if (seen.has(eventId || hash)) {
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
    seen.add(eventId || hash);
    return NextResponse.json({ success: true, ignored: true });
  }
  const result = await creditFromWebhook({
    merchantOrderId: String(
      payload.merchOrderId || payload.merchantOrderId || '',
    ),
    providerTransactionId: String(
      payload.transId || payload.transactionNumber || '',
    ),
    amount: Number(payload.totalAmount || payload.amount),
    currency: String(payload.currency || 'ETB'),
  });
  if (result.ok) seen.add(eventId || hash);
  return NextResponse.json({ success: result.ok, message: result.message });
}
