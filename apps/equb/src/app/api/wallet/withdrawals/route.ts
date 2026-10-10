import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import {
  createWithdrawal,
  listUserWithdrawals,
  withdrawalPublicInfo,
} from '@/lib/wallet/withdrawals';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Resolve user id: prefer signed session cookie; fall back to body/query userId
 * (same pattern as /api/wallet/deposits so logged-in zustand users still work).
 */
async function resolveUserId(
  req: NextRequest,
  bodyUserId?: string,
): Promise<string | null> {
  try {
    const sessionUser = await getSessionUser(req);
    if (sessionUser?.id) return sessionUser.id;
  } catch {
    /* ignore */
  }
  const q = req.nextUrl.searchParams.get('userId');
  if (q && q.trim()) return q.trim();
  if (bodyUserId && String(bodyUserId).trim()) return String(bodyUserId).trim();
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          message: 'Sign in required',
          withdrawals: [],
          config: withdrawalPublicInfo(),
        },
        { status: 401 },
      );
    }

    const items = await listUserWithdrawals(userId);
    return NextResponse.json({
      success: true,
      withdrawals: items,
      config: withdrawalPublicInfo(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'Could not load withdrawals',
        withdrawals: [],
        config: withdrawalPublicInfo(),
      },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const userId = await resolveUserId(req, String(body.userId || ''));
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Sign in first' },
        { status: 401 },
      );
    }

    const ip = clientIp(req);
    const rl = rateLimit(`withdraw:${userId}:${ip}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        {
          success: false,
          message: `Too many requests — try again in ${rl.retryAfterSec}s`,
        },
        { status: 429 },
      );
    }

    const amount = Number(body.amount);
    const payoutPhone = String(body.payoutPhone || body.phone || '').trim();

    const result = await createWithdrawal({
      userId,
      amount,
      payoutPhone,
    });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message:
        'Withdrawal requested. Admin will send ETB to your Telebirr number.',
      withdrawal: result.withdrawal,
      balance: result.balance,
    });
  } catch (e: unknown) {
    console.error('[withdrawals POST]', e);
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'Withdrawal failed',
      },
      { status: 500 },
    );
  }
}
