import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { adminList } from '@/lib/server/admin-users';
import { listDepositsAsync } from '@/lib/wallet/deposits';
import { listWalletHistory } from '@/lib/server/wallets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const limit = Number(req.nextUrl.searchParams.get('limit') || 100);
  const userId = req.nextUrl.searchParams.get('userId') || undefined;

  const users = await adminList().catch(
    () => [] as Awaited<ReturnType<typeof adminList>>,
  );
  const byId = new Map(users.map((u) => [u.id, u]));

  const deposits = (await listDepositsAsync(userId)).map((d) => {
    const u = byId.get(d.userId);
    return {
      kind: 'deposit' as const,
      id: d.id,
      userId: d.userId,
      userName: u?.fullName ?? null,
      userPhone: u?.phone ?? null,
      amount: d.amount,
      delta: d.status === 'CONFIRMED' ? d.amount : 0,
      status: d.status,
      transactionNumber: d.transactionNumber,
      merchantOrderId: d.merchantOrderId,
      failureReason: d.failureReason,
      adminNote: d.adminNote ?? null,
      createdAt: d.createdAt,
      confirmedAt: d.confirmedAt,
      at: Date.parse(d.confirmedAt || d.createdAt) || Date.now(),
      reason: 'deposit_telebirr',
    };
  });

  const ledger = listWalletHistory({ playerId: userId, limit: 200 }).map((e) => {
    const u = byId.get(e.playerId);
    return {
      kind: 'ledger' as const,
      id: e.id,
      userId: e.playerId,
      userName: u?.fullName ?? null,
      userPhone: u?.phone ?? null,
      amount: Math.abs(e.delta),
      delta: e.delta,
      balance: e.balance,
      status: e.delta >= 0 ? 'CREDIT' : 'DEBIT',
      transactionNumber: null as string | null,
      merchantOrderId: null as string | null,
      failureReason: null as string | null,
      adminNote: null as string | null,
      createdAt: new Date(e.at).toISOString(),
      confirmedAt: new Date(e.at).toISOString(),
      at: e.at,
      reason: e.reason,
    };
  });

  const merged = [...deposits, ...ledger]
    .sort((a, b) => b.at - a.at)
    .slice(0, Math.min(Math.max(limit, 1), 200));

  const confirmedDeps = deposits.filter((d) => d.status === 'CONFIRMED');
  const pendingDeps = deposits.filter(
    (d) =>
      d.status === 'PENDING' ||
      d.status === 'PROCESSING' ||
      d.status === 'REVIEW_REQUIRED',
  );

  return NextResponse.json({
    success: true,
    data: {
      items: merged,
      summary: {
        depositsTotal: deposits.length,
        depositsPending: pendingDeps.length,
        depositsConfirmed: confirmedDeps.length,
        depositsVolume: confirmedDeps.reduce((s, d) => s + d.amount, 0),
        ledgerEvents: ledger.length,
      },
    },
  });
}
