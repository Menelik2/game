import { NextRequest, NextResponse } from 'next/server';
import { ensureWallet } from '@/lib/server/wallets';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await ctx.params;
  const w = ensureWallet(decodeURIComponent(playerId));
  return NextResponse.json({ success: true, data: w });
}
