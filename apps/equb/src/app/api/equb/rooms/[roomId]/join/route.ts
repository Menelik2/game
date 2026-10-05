import { NextRequest, NextResponse } from 'next/server';
import { joinRoom } from '@/lib/server/equb-rooms';
import { joinShared, sharedEnabled } from '@/lib/server/shared-rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  try {
    const body = await req.json().catch(() => ({}));
    const playerId = String(body.playerId || '');
    const name = String(body.name || 'Player');
    const pick = Number(body.pick);
    if (!playerId || !Number.isFinite(pick)) {
      return NextResponse.json({ success: false, message: 'playerId and pick required' }, { status: 400 });
    }
    const id = decodeURIComponent(roomId);
    const room = sharedEnabled() ? await joinShared(id, playerId, name, pick) : joinRoom(id, playerId, name, pick);
    return NextResponse.json({ success: true, data: room, shared: sharedEnabled() });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Join failed' }, { status: 400 });
  }
}
