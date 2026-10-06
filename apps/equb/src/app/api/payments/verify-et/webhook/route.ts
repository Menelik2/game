import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { creditFromWebhook } from '@/lib/wallet/deposits';
import { verifyEtConfig } from '@/lib/verify-et/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function validSignature(
  raw: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!secret || !signatureHeader) return !secret;
  try {
    const parts = signatureHeader.split(',');
    let ts = '';
    let sig = signatureHeader;
    for (const p of parts) {
      const [k, v] = p.trim().split('=');
      if (k === 't') ts = v || '';
      if (k === 'v1' || k === 'sig') sig = v || sig;
    }
    const payload = ts ? `${ts}.${raw}` : raw;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(sig.replace(/^sha256=/i, ''));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const cfg = verifyEtConfig();
  const test = req.headers.get('x-webhook-test') === 'true';
  if (test) return new NextResponse(null, { status: 204 });

  if (cfg.webhookSecret) {
    const ok = validSignature(
      raw,
      req.headers.get('x-verify-signature') ||
        req.headers.get('x-signature') ||
        req.headers.get('signature'),
      cfg.webhookSecret,
    );
    if (!ok) {
      return NextResponse.json(
        { success: false, message: 'Invalid signature' },
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

  const data = body?.data;
  const item = (
    Array.isArray(data)
      ? data[0]
      : data || body?.verification || body
  ) as Record<string, unknown> | undefined;

  if (!item?.verified && item?.status !== 'success') {
    return new NextResponse(null, { status: 204 });
  }

  const result = await creditFromWebhook({
    transactionNumber: String(
      item.transactionNumber || item.referenceNumber || '',
    ),
    providerTransactionId: String(
      item.referenceNumber || item.transactionNumber || item.id || '',
    ),
    amount: Number(item.amount || 0),
    currency: String(item.currency || 'ETB'),
  });

  return NextResponse.json({ success: result.ok, message: result.message });
}
