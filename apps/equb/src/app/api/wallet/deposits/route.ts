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

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Valid amount required' },
        { status: 400 },
      );
    }

    const deposit = await createDeposit({
      userId,
      amount,
      merchantOrderId: body.merchantOrderId
        ? String(body.merchantOrderId)
        : undefined,
    });

    const wallet = await walletOfAsync(userId);
    return NextResponse.json({
      success: true,
      deposit,
      checkoutUrl: deposit.checkoutUrl,
      wallet,
      config: publicWalletConfig(),
      message:
        'Deposit created. Complete payment with Telebirr, then claim with transaction number.',
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
