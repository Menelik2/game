import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import {
  createWithdrawal,
  listUserWithdrawals,
  withdrawalPublicInfo,
} from '@/lib/wallet/withdrawals';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';
import {
  assertBodySize,
  originAllowed,
  forbiddenOrigin,
  withSecurityHeaders,
} from '@/lib/server/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return withSecurityHeaders(auth.response);

  const items = await listUserWithdrawals(auth.user.id);
  return withSecurityHeaders(
    NextResponse.json({
      success: true,
      withdrawals: items,
      config: withdrawalPublicInfo(),
    }),
  );
}

export async function POST(req: NextRequest) {
  const tooBig = assertBodySize(req);
  if (tooBig) return withSecurityHeaders(tooBig);
  if (!originAllowed(req)) return withSecurityHeaders(forbiddenOrigin());

  const auth = await requireUser(req);
  if (!auth.ok) return withSecurityHeaders(auth.response);

  const ip = clientIp(req);
  const rl = rateLimit(`withdraw:${auth.user.id}:${ip}`, 8, 60_000);
  if (!rl.ok) {
    return withSecurityHeaders(
      NextResponse.json(
        { success: false, message: 'Too many requests — try again later' },
        { status: 429 },
      ),
    );
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const amount = Number(body.amount);
    const payoutPhone = String(body.payoutPhone || body.phone || '').trim();

    const result = await createWithdrawal({
      userId: auth.user.id,
      amount,
      payoutPhone,
    });

    if (!result.ok) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: result.message },
          { status: 400 },
        ),
      );
    }

    return withSecurityHeaders(
      NextResponse.json({
        success: true,
        message:
          'Withdrawal requested. Admin will send ETB to your Telebirr number.',
        withdrawal: result.withdrawal,
        balance: result.balance,
      }),
    );
  } catch (e: unknown) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: e instanceof Error ? e.message : 'Withdrawal failed',
        },
        { status: 500 },
      ),
    );
  }
}
