import { NextRequest, NextResponse } from 'next/server';
import { createDeposit, listDeposits, publicWalletConfig, walletOf } from '@/lib/wallet/deposits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') || '';
  if (!userId) {
    return NextResponse.json({ success: false, message: 'userId required' }, { status: 400 });
  }
  const deposits = listDeposits(userId);
  const wallet = walletOf(userId);
  return NextResponse.json({
    success: true,
    deposits,
    wallet,
    config: publicWalletConfig(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || '');
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Sign in first' }, { status: 401 });
    }
    const origin = req.nextUrl.origin;
    const result = await createDeposit({ userId, amount: body.amount, origin });
    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      deposit: result.deposit,
      payment: { checkoutUrl: null, method: 'telebirr-manual', verifier: 'verify.et' },
      config: publicWalletConfig(),
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Create failed' }, { status: 500 });
  }
}
