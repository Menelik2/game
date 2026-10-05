import { NextResponse } from 'next/server';
import { paymentPublicConfig } from '@/lib/payments/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: paymentPublicConfig() });
  } catch (e: any) {
    return NextResponse.json(
      {
        success: true,
        data: {
          mode: 'demo',
          provider: 'none',
          realMoneyLive: false,
          currency: 'ETB',
          minDeposit: 10,
          maxDeposit: 50000,
          note: 'Demo mode',
          error: e?.message,
        },
      },
    );
  }
}
