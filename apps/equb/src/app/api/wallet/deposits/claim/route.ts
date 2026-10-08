import { NextRequest, NextResponse } from 'next/server';
import { claimByTransactionNumber } from '@/lib/wallet/deposits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Deposit real money with Telebirr transaction number only.
 * Body: { userId, transactionNumber }
 * Verifies via Verify.ET (or configured API), then credits wallet balance.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || body.playerId || '');
    const transactionNumber = String(
      body.transactionNumber || body.txn || body.sms || '',
    ).trim();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Sign in first' },
        { status: 401 },
      );
    }
    if (transactionNumber.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: 'Enter a valid Telebirr transaction number',
        },
        { status: 400 },
      );
    }

    const result = await claimByTransactionNumber({
      userId,
      transactionNumber,
    });

    const unavailable = /unavailable|not configured/i.test(result.message || '');
    const http = result.ok ? 200 : unavailable ? 503 : 400;

    const deposit = 'deposit' in result ? result.deposit : undefined;
    const balance = 'balance' in result ? result.balance : undefined;
    const amount = deposit?.amount;

    return NextResponse.json(
      {
        success: result.ok,
        status: result.status,
        message: result.message,
        amount,
        currency: 'ETB',
        balance,
        deposit,
      },
      { status: http },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Claim failed';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
