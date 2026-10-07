import { NextRequest, NextResponse } from 'next/server';
import { telebirrPublicConfig, hasSigningSecrets } from '@/lib/telebirr/config';
import { verifyEtConfig, publicWalletConfig } from '@/lib/verify-et/config';
import {
  listDeposits,
  adminConfirmDeposit,
  adminRejectDeposit,
} from '@/lib/wallet/deposits';
import { requireAdmin, sanitizeText } from '@/lib/server/admin-auth';
import { pushAudit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const tb = telebirrPublicConfig();
  const ve = verifyEtConfig();
  const pub = publicWalletConfig();
  const items = listDeposits();
  const pending = items.filter(
    (d) =>
      d.status === 'PENDING' ||
      d.status === 'PROCESSING' ||
      d.status === 'REVIEW_REQUIRED',
  );
  const confirmed = items.filter((d) => d.status === 'CONFIRMED');
  const today = new Date().toISOString().slice(0, 10);
  const todayVolume = confirmed
    .filter((d) => (d.confirmedAt || d.createdAt || '').startsWith(today))
    .reduce((s, d) => s + Number(d.amount), 0);

  return NextResponse.json({
    success: true,
    data: {
      merchant: {
        name: tb.merchantName,
        phone: tb.merchantPhone,
        currency: 'ETB',
        minDeposit: tb.minDeposit,
        maxDeposit: tb.maxDeposit,
        environment: tb.environment,
        enabled: tb.enabled,
        instruction: tb.instruction,
      },
      verifyEt: {
        configured: ve.configured,
        keyHint: ve.keyHint,
        baseUrl: ve.baseUrl,
        environment: pub.environment,
      },
      telebirrApi: {
        checkoutAvailable: tb.checkoutAvailable,
        hasSigningSecrets: hasSigningSecrets(),
      },
      summary: {
        total: items.length,
        pending: pending.length,
        confirmed: confirmed.length,
        failed: items.filter((d) => d.status === 'FAILED').length,
        todayVolume,
      },
      deposits: items.slice(0, 50),
      pending,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');
    const depositId = sanitizeText(body.depositId, 80);
    if (!depositId) {
      return NextResponse.json(
        { success: false, message: 'depositId required' },
        { status: 400 },
      );
    }

    if (action === 'confirm') {
      const result = await adminConfirmDeposit({
        depositId,
        transactionNumber: body.transactionNumber
          ? sanitizeText(body.transactionNumber, 64)
          : undefined,
        note: body.note ? sanitizeText(body.note, 200) : undefined,
      });
      pushAudit({
        action: 'admin.deposit.confirm',
        entity: 'deposit',
        entityId: depositId,
        userId: auth.admin.id,
        meta: { ok: result.ok },
      });
      return NextResponse.json(
        {
          success: result.ok,
          message: result.message,
          balance: result.balance,
          deposit: result.deposit,
        },
        { status: result.ok ? 200 : 400 },
      );
    }

    if (action === 'reject') {
      const result = await adminRejectDeposit({
        depositId,
        reason: body.reason
          ? sanitizeText(body.reason, 200)
          : 'Rejected by admin',
      });
      pushAudit({
        action: 'admin.deposit.reject',
        entity: 'deposit',
        entityId: depositId,
        userId: auth.admin.id,
      });
      return NextResponse.json(
        {
          success: result.ok,
          message: result.message,
          deposit: result.deposit,
        },
        { status: result.ok ? 200 : 400 },
      );
    }

    return NextResponse.json(
      { success: false, message: 'action must be confirm or reject' },
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
