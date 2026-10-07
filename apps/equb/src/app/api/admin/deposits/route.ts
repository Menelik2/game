import { NextRequest, NextResponse } from 'next/server';
import {
  listDepositsAsync,
  adminConfirmDeposit,
  adminRejectDeposit,
} from '@/lib/wallet/deposits';
import { requireAdmin, sanitizeText } from '@/lib/server/admin-auth';
import { pushAudit } from '@/lib/server/audit';
import { verifyEtConfig } from '@/lib/verify-et/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const items = await listDepositsAsync();
  const confirmed = items.filter((d) => d.status === 'CONFIRMED');
  const today = new Date().toISOString().slice(0, 10);
  const cfg = verifyEtConfig();

  return NextResponse.json({
    success: true,
    data: {
      items,
      summary: {
        total: items.length,
        pending: items.filter(
          (d) =>
            d.status === 'PENDING' ||
            d.status === 'PROCESSING' ||
            d.status === 'REVIEW_REQUIRED',
        ).length,
        confirmed: confirmed.length,
        volume: confirmed.reduce((s, d) => s + d.amount, 0),
        todayVolume: confirmed
          .filter((d) => (d.confirmedAt || '').startsWith(today))
          .reduce((s, d) => s + d.amount, 0),
      },
      verifyEtConfigured: cfg.configured,
    },
  });
}

/** Approve or reject a deposit (manual until Verify.ET is configured) */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase();
    const depositId = String(body.depositId || body.id || '').trim();
    if (!depositId) {
      return NextResponse.json(
        { success: false, message: 'depositId required' },
        { status: 400 },
      );
    }

    if (action === 'approve' || action === 'confirm') {
      const result = await adminConfirmDeposit({
        depositId,
        transactionNumber: body.transactionNumber
          ? String(body.transactionNumber)
          : undefined,
        note: body.note ? sanitizeText(String(body.note), 200) : 'Admin approved',
      });
      if (!result.ok) {
        return NextResponse.json(
          { success: false, message: result.message, deposit: result.deposit },
          { status: 400 },
        );
      }
      pushAudit({
        action: 'admin.deposit.approve',
        entity: 'deposit',
        entityId: depositId,
        userId: auth.admin.id,
        meta: {
          amount: result.deposit?.amount,
          balance: result.balance,
        },
      });
      return NextResponse.json({
        success: true,
        message: result.message,
        deposit: result.deposit,
        balance: result.balance,
      });
    }

    if (action === 'reject') {
      const result = await adminRejectDeposit({
        depositId,
        reason: body.reason
          ? sanitizeText(String(body.reason), 200)
          : 'Rejected by admin',
      });
      if (!result.ok) {
        return NextResponse.json(
          { success: false, message: result.message },
          { status: 400 },
        );
      }
      pushAudit({
        action: 'admin.deposit.reject',
        entity: 'deposit',
        entityId: depositId,
        userId: auth.admin.id,
      });
      return NextResponse.json({
        success: true,
        message: 'Deposit rejected',
        deposit: result.deposit,
      });
    }

    return NextResponse.json(
      { success: false, message: 'action must be approve or reject' },
      { status: 400 },
    );
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'Action failed',
      },
      { status: 500 },
    );
  }
}
