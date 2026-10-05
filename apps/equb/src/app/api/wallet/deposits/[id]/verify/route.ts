import { NextRequest, NextResponse } from 'next/server';
import { verifyDeposit } from '@/lib/wallet/deposits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || '');
  const transactionNumber = String(body.transactionNumber || body.sms || '').trim();
  if (!userId) return NextResponse.json({ success: false, message: 'Sign in first' }, { status: 401 });
  const result = await verifyDeposit({ depositId: id, userId, transactionNumber });
  const status = result.status === 'UNAVAILABLE' ? 503 : result.ok ? 200 : 400;
  return NextResponse.json(
    {
      success: result.ok,
      status: result.status,
      message: result.message,
      amount: result.deposit?.amount,
      currency: 'ETB',
      balance: result.balance,
      deposit: result.deposit,
    },
    { status },
  );
}
