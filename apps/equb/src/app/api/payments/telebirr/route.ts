import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  TELEBIRR_NAME,
  TELEBIRR_PHONE,
  listClaims,
  parseTelebirrSms,
  saveClaim,
} from '@/lib/payments/telebirr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      method: 'telebirr',
      phone: TELEBIRR_PHONE,
      name: TELEBIRR_NAME,
      note: 'Send ETB via Telebirr, then paste the confirmation SMS. Balance is credited only after verification.',
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || '');
  const sms = String(body.sms || body.txn || '').trim();
  if (!userId) {
    return NextResponse.json({ success: false, message: 'Sign in first' }, { status: 400 });
  }
  if (sms.length < 4) {
    return NextResponse.json(
      { success: false, message: 'Paste the confirmation SMS or transaction number' },
      { status: 400 },
    );
  }
  const parsed = parseTelebirrSms(sms);
  const dup = listClaims().find(
    (c) => c.txnRef === parsed.txnRef && c.status !== 'REJECTED',
  );
  if (dup) {
    return NextResponse.json(
      { success: false, message: 'This transaction was already submitted' },
      { status: 400 },
    );
  }
  const claim = {
    id: randomUUID(),
    userId,
    phone: String(body.phone || ''),
    amount: parsed.amount,
    txnRef: parsed.txnRef,
    sms: sms.slice(0, 500),
    status: 'PENDING' as const,
    createdAt: new Date().toISOString(),
  };
  saveClaim(claim);
  return NextResponse.json({
    success: true,
    data: {
      id: claim.id,
      status: 'PENDING',
      amount: claim.amount,
      txnRef: claim.txnRef,
      message:
        'Deposit submitted. It stays pending until the Telebirr SMS is verified — balance is not updated yet.',
    },
  });
}
