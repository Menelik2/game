/**
 * Verify.ET webhook — https://verify.et/docs/api#webhooks
 *
 * Register in dashboard: https://your-domain/api/payments/verify-et/webhook
 * Secret: VERIFY_ET_WEBHOOK_SECRET (whsec_…)
 * Header: X-Webhook-Signature: sha256=<hex>
 * Test pings: X-Webhook-Test: true → reply 204
 * Event: verification.completed
 */

import { NextRequest, NextResponse } from 'next/server';
import { creditFromWebhook } from '@/lib/wallet/deposits';
import { verifyEtConfig } from '@/lib/verify-et/config';
import { verifyWebhookSignature } from '@/lib/verify-et/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const cfg = verifyEtConfig();

  // Dashboard “Send test” — must return 2xx to activate endpoint
  if (req.headers.get('x-webhook-test') === 'true') {
    return new NextResponse(null, { status: 204 });
  }

  if (cfg.webhookSecret) {
    const ok = verifyWebhookSignature(
      raw,
      req.headers.get('x-webhook-signature') ||
        req.headers.get('X-Webhook-Signature'),
      cfg.webhookSecret,
      req.headers.get('x-webhook-timestamp') ||
        req.headers.get('X-Webhook-Timestamp'),
    );
    if (!ok) {
      return NextResponse.json(
        { success: false, message: 'Invalid webhook signature' },
        { status: 401 },
      );
    }
  }

  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(raw || '{}');
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON' },
      { status: 400 },
    );
  }

  const event = String(body.event || '');
  // webhook.test or non-completed events → ack only
  if (event === 'webhook.test') {
    return new NextResponse(null, { status: 204 });
  }

  const data = (body.data || {}) as Record<string, unknown>;
  const verified =
    data.verified === true ||
    data.status === 'success' ||
    event === 'verification.succeeded';

  if (!verified) {
    // verification.failed / not_found — acknowledge, no credit
    return new NextResponse(null, { status: 204 });
  }

  const amount = Number(data.amount);
  const txn = String(
    data.transactionNumber ||
      data.referenceNumber ||
      data.receiptNumber ||
      '',
  );
  const providerId = String(
    data.referenceNumber || data.transactionNumber || body.requestId || txn,
  );

  if (!txn && !providerId) {
    return new NextResponse(null, { status: 204 });
  }

  const result = await creditFromWebhook({
    transactionNumber: txn || undefined,
    providerTransactionId: providerId,
    amount: Number.isFinite(amount) ? amount : 0,
    currency: String(data.currency || 'ETB'),
  });

  // Docs: Any 2xx. Prefer 204 after accept.
  if (result.ok) return new NextResponse(null, { status: 204 });
  return NextResponse.json(
    { success: false, message: result.message },
    { status: 200 },
  );
}
