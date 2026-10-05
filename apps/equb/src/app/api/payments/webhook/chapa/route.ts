import { NextRequest, NextResponse } from 'next/server';
import { chapaVerify, chapaVerifyWebhookSignature } from '@/lib/payments/chapa';
import { getTxByProviderRef, updateTx } from '@/lib/payments/store';
import { dbAdjustBalance, isDbConfigured } from '@/lib/server/db-users';
import { isRealMoneyLive } from '@/lib/payments/config';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isRealMoneyLive()) {
    return NextResponse.json({ success: false, message: 'Real money disabled' }, { status: 403 });
  }

  const raw = await req.text();
  const signature =
    req.headers.get('chapa-signature') || req.headers.get('x-chapa-signature');

  if (!chapaVerifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ success: false, message: 'Invalid signature' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const txRef = String(body?.tx_ref || body?.trx_ref || body?.data?.tx_ref || '');
  if (!txRef) {
    return NextResponse.json({ success: false, message: 'tx_ref missing' }, { status: 400 });
  }

  const verified = await chapaVerify(txRef);
  const local = getTxByProviderRef(txRef);

  if (!local) {
    return NextResponse.json({
      success: true,
      message: 'Unknown tx_ref',
      txRef,
      verified,
    });
  }

  if (local.status === 'COMPLETED') {
    return NextResponse.json({ success: true, message: 'Already completed', id: local.id });
  }

  if (verified.status === 'success') {
    updateTx(local.id, { status: 'COMPLETED' });
    if (isDbConfigured()) {
      try {
        await dbAdjustBalance(local.userId, local.amount, `deposit:${txRef}`);
      } catch (e: any) {
        return NextResponse.json(
          { success: false, message: e?.message || 'Credit failed' },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({
      success: true,
      message: 'Deposit completed and wallet credited',
      id: local.id,
    });
  }

  if (verified.status === 'failed') {
    updateTx(local.id, { status: 'FAILED' });
    return NextResponse.json({ success: true, message: 'Marked failed', id: local.id });
  }

  updateTx(local.id, { status: 'PROCESSING' });
  return NextResponse.json({ success: true, message: 'Still pending', id: local.id });
}

export async function GET(req: NextRequest) {
  const txRef =
    req.nextUrl.searchParams.get('trx_ref') ||
    req.nextUrl.searchParams.get('tx_ref');
  if (!txRef || !isRealMoneyLive()) {
    return NextResponse.redirect(new URL('/wallet', req.url));
  }
  const verified = await chapaVerify(txRef);
  const local = getTxByProviderRef(txRef);
  if (local && verified.status === 'success' && local.status !== 'COMPLETED') {
    updateTx(local.id, { status: 'COMPLETED' });
    if (isDbConfigured()) {
      await dbAdjustBalance(local.userId, local.amount, `deposit:${txRef}`).catch(
        () => null,
      );
    }
  }
  return NextResponse.redirect(new URL('/wallet?deposit=done', req.url));
}
