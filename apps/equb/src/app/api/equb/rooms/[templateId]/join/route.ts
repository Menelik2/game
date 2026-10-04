import { NextRequest, NextResponse } from 'next/server';
import { joinRoom } from '@/lib/server/equb-rooms';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await ctx.params;
  try {
    const body = await req.json().catch(() => ({}));
    const playerId = String(body.playerId || '');
    const name = String(body.name || 'Player');
    const pick = Number(body.pick);
    if (!playerId || !Number.isFinite(pick)) {
      return NextResponse.json(
        { success: false, message: 'playerId and pick required' },
        { status: 400 },
      );
    }
    const room = joinRoom(decodeURIComponent(templateId), playerId, name, pick);
    return NextResponse.json({ success: true, data: room });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || 'Join failed' },
      { status: 400 },
    );
  }
}
