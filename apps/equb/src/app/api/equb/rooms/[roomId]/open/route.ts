import { NextRequest, NextResponse } from 'next/server';
import { ensureOpen, withTimer } from '@/lib/server/equb-rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await ctx.params;
  try {
    const room = ensureOpen(decodeURIComponent(roomId));
    return NextResponse.json({ success: true, data: withTimer(room) });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || 'Open failed' },
      { status: 400 },
    );
  }
}
