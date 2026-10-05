import { NextRequest, NextResponse } from 'next/server';
import { listClaims, updateClaim } from '@/lib/payments/telebirr';
import { dbAdjustBalance, isDbConfigured } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId') || undefined;
  const items = listClaims(userId || undefined);
  return NextResponse.json({ success: true, data: { items } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '');
  const action = String(body.action || '');
  const claim = updateClaim(id, action === 'approve' ? 'APPROVED' : 'REJECTED');
  if (!claim) {
    return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  }
  if (action === 'approve') {
    if (claim.amount == null || claim.amount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Amount missing in SMS' },
        { status: 400 },
      );
    }
    if (isDbConfigured()) {
      try {
        await dbAdjustBalance(claim.userId, claim.amount, `telebirr:${claim.txnRef}`);
      } catch (e: any) {
        return NextResponse.json(
          { success: false, message: e?.message || 'Credit failed' },
          { status: 400 },
        );
      }
    }
  }
  return NextResponse.json({ success: true, data: claim });
}
