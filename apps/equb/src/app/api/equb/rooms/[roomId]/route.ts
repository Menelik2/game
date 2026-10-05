import { NextRequest, NextResponse } from 'next/server';
import { ensureOpen, getRoom, maybeDraw, withTimer } from '@/lib/server/equb-rooms';
import { getShared, sharedEnabled } from '@/lib/server/shared-rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  const id = decodeURIComponent(roomId);
  if (sharedEnabled() && /^equb-\d+-\d+/.test(id)) {
    const templateId = id.match(/^equb-\d+-\d+/)![0];
    const room = await getShared(templateId);
    return NextResponse.json({ success: true, data: room, shared: true });
  }
  let room = getRoom(id);
  if (!room) {
    if (/^equb-\d+-\d+$/.test(id)) room = ensureOpen(id);
    else return NextResponse.json({ success: false, message: 'Room not found' }, { status: 404 });
  }
  room = maybeDraw(room);
  return NextResponse.json({ success: true, data: withTimer(room), shared: false });
}
