import { NextRequest, NextResponse } from 'next/server';
import { createDeposit, listDeposits, walletOf } from '@/lib/wallet/deposits';
import { telebirrPublicConfig } from '@/lib/telebirr/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') || '';
  if (!userId) return NextResponse.json({ success: false, message: 'Sign in first' }, { status: 401 });
  return NextResponse.json({
    success: true,
    config: telebirrPublicConfig(),
    wallet: walletOf(userId),
    deposits: listDeposits(userId),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || '');
  if (!userId) return NextResponse.json({ success: false, message: 'Sign in first' }, { status: 401 });
  if (body.paymentMethod && body.paymentMethod !== 'telebirr') {
    return NextResponse.json({ success: false, message: 'Only Telebirr is enabled' }, { status: 400 });
  }
  const origin = req.nextUrl.origin;
  const result = await createDeposit({ userId, amount: body.amount, origin });
  if (!result.ok) return NextResponse.json({ success: false, message: result.message }, { status: 400 });
  return NextResponse.json({
    success: true,
    deposit: result.deposit,
    payment: { checkoutUrl: result.checkoutUrl, reference: result.deposit.merchantOrderId },
  });
}
