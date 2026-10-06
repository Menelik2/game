import { NextRequest, NextResponse } from 'next/server';
import { createDeposit, listDeposits } from '@/lib/wallet/deposits';
import { publicWalletConfig, walletOfAsync } from '@/lib/wallet/wallet-view';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') || '';
  if (!userId) {
    return NextResponse.json(
      { success: false, message: 'userId required' },
      { status: 400 },
    );
  }
  const deposits = listDeposits(userId);
  const wallet = await walletOfAsync(userId);
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
      return NextResponse.json(
        { success: false, message: 'Sign in first' },
        { status: 401 },
      );
    }
    const origin = req.nextUrl.origin;
    const created = await createDeposit({
      userId,
      amount: body.amount,
      origin,
    });
    if (!created.ok) {
      return NextResponse.json(
        { success: false, message: created.message },
        { status: 400 },
      );
    }
    const wallet = await walletOfAsync(userId);
    return NextResponse.json({
      success: true,
      deposit: created.deposit,
      checkoutUrl: created.checkoutUrl,
      wallet,
      config: publicWalletConfig(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'Deposit failed',
      },
      { status: 500 },
    );
  }
}
