import { NextRequest, NextResponse } from 'next/server';
import { applyDelta } from '@/lib/server/wallets';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const playerId = String(body.playerId || '');
  const amount = Number(body.amount);
  const reason = String(body.reason || 'credit');
  if (!playerId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { success: false, message: 'playerId and positive amount required' },
      { status: 400 },
    );
  }
  const next = applyDelta(playerId, amount, reason);
  return NextResponse.json({ success: true, data: next });
}
