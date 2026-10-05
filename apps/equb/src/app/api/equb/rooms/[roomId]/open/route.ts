import { NextRequest, NextResponse } from 'next/server';
import { ensureOpen, withTimer } from '@/lib/server/equb-rooms';
import { openShared, sharedEnabled } from '@/lib/server/shared-rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  try {
    const id = decodeURIComponent(roomId);
    const room = sharedEnabled() ? await openShared(id) : withTimer(ensureOpen(id));
    return NextResponse.json({ success: true, data: room, shared: sharedEnabled() });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Open failed' }, { status: 400 });
  }
}
