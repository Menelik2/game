import { NextRequest, NextResponse } from 'next/server';
import { joinRoom } from '@/lib/server/equb-rooms';
import { joinShared, sharedEnabled } from '@/lib/server/shared-rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await ctx.params;
  try {
    const body = await req.json().catch(() => ({}));
    const playerId = String(body.playerId || '');
    const name = String(body.name || 'Player');
    // Support picks[] (multi) or single pick
    let picks: number[] = [];
    if (Array.isArray(body.picks)) {
      picks = body.picks.map((n: unknown) => Number(n));
    } else if (body.pick != null) {
      picks = [Number(body.pick)];
    }
    if (!playerId || picks.length === 0 || picks.some((p) => !Number.isFinite(p))) {
      return NextResponse.json(
        { success: false, message: 'playerId and pick(s) required' },
        { status: 400 },
      );
    }
    const id = decodeURIComponent(roomId);
    const room = sharedEnabled()
      ? await joinShared(id, playerId, name, picks)
      : joinRoom(id, playerId, name, picks);
    return NextResponse.json({
      success: true,
      data: room,
      shared: sharedEnabled(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'Join failed',
      },
      { status: 400 },
    );
  }
}
