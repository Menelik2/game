import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, sanitizeText } from '@/lib/server/admin-auth';
import {
  listAllWithdrawals,
  adminMarkPaid,
  adminRejectWithdrawal,
  withdrawalPublicInfo,
} from '@/lib/wallet/withdrawals';
import { pushAudit } from '@/lib/server/audit';
import {
  assertBodySize,
  originAllowed,
  forbiddenOrigin,
  withSecurityHeaders,
} from '@/lib/server/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return withSecurityHeaders(auth.response);

  const status = req.nextUrl.searchParams.get('status') || undefined;
  const items = await listAllWithdrawals(
    status as 'PENDING' | 'PAID' | 'REJECTED' | undefined,
  );
  const pending = items.filter((w) => w.status === 'PENDING').length;
  const totalPendingAmount = items
    .filter((w) => w.status === 'PENDING')
    .reduce((s, w) => s + w.amount, 0);

  return withSecurityHeaders(
    NextResponse.json({
      success: true,
      data: {
        withdrawals: items,
        summary: {
          pending,
          totalPendingAmount: Math.round(totalPendingAmount * 100) / 100,
          total: items.length,
        },
        config: withdrawalPublicInfo(),
      },
    }),
  );
}

export async function POST(req: NextRequest) {
  const tooBig = assertBodySize(req);
  if (tooBig) return withSecurityHeaders(tooBig);
  if (!originAllowed(req)) return withSecurityHeaders(forbiddenOrigin());

  const auth = await requireAdmin(req);
  if (!auth.ok) return withSecurityHeaders(auth.response);

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action = String(body.action || '').trim();
    const withdrawalId = String(body.withdrawalId || body.id || '').trim();
    if (!withdrawalId) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'withdrawalId required' },
          { status: 400 },
        ),
      );
    }

    if (action === 'pay' || action === 'complete' || action === 'approve') {
      const result = await adminMarkPaid({
        withdrawalId,
        adminId: auth.admin.id,
        note: body.note ? sanitizeText(String(body.note), 200) : undefined,
      });
      if (!result.ok) {
        return withSecurityHeaders(
          NextResponse.json(
            { success: false, message: result.message, withdrawal: result.withdrawal },
            { status: 400 },
          ),
        );
      }
      pushAudit({
        action: 'admin.withdrawal.paid',
        entity: 'withdrawal',
        entityId: withdrawalId,
        userId: auth.admin.id,
        meta: { amount: result.withdrawal.amount, phone: result.withdrawal.payoutPhone },
      });
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message: result.message,
          withdrawal: result.withdrawal,
        }),
      );
    }

    if (action === 'reject') {
      const result = await adminRejectWithdrawal({
        withdrawalId,
        adminId: auth.admin.id,
        reason: body.reason
          ? sanitizeText(String(body.reason), 200)
          : 'Rejected by admin',
      });
      if (!result.ok) {
        return withSecurityHeaders(
          NextResponse.json(
            { success: false, message: result.message, withdrawal: result.withdrawal },
            { status: 400 },
          ),
        );
      }
      pushAudit({
        action: 'admin.withdrawal.reject',
        entity: 'withdrawal',
        entityId: withdrawalId,
        userId: auth.admin.id,
        meta: { amount: result.withdrawal.amount },
      });
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message: result.message,
          withdrawal: result.withdrawal,
          balance: result.balance,
        }),
      );
    }

    return withSecurityHeaders(
      NextResponse.json(
        { success: false, message: 'Unknown action. Use: pay | reject' },
        { status: 400 },
      ),
    );
  } catch (e: unknown) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: e instanceof Error ? e.message : 'Action failed',
        },
        { status: 500 },
      ),
    );
  }
}
