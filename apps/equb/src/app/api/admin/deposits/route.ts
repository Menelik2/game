import { NextRequest, NextResponse } from 'next/server';
import { listDeposits } from '@/lib/wallet/deposits';
import { requireAdmin } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const items = listDeposits();
  const confirmed = items.filter((d) => d.status === 'CONFIRMED');
  const today = new Date().toISOString().slice(0, 10);
  return NextResponse.json({
    success: true,
    data: {
      total: items.length,
      pending: items.filter(
        (d) => d.status === 'PENDING' || d.status === 'PROCESSING',
      ).length,
      confirmed: confirmed.length,
      failed: items.filter((d) => d.status === 'FAILED').length,
      review: items.filter((d) => d.status === 'REVIEW_REQUIRED').length,
      todayVolume: confirmed
        .filter((d) => (d.confirmedAt || '').startsWith(today))
        .reduce((s, d) => s + d.amount, 0),
      items,
    },
  });
}
