import { NextRequest, NextResponse } from 'next/server';
import {
  ensureOpen,
  getRoom,
  maybeDraw,
  withTimer,
} from '@/lib/server/equb-rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await ctx.params;
  let room = getRoom(roomId);
  if (!room) {
    if (/^equb-\d+-\d+$/.test(roomId)) {
      room = ensureOpen(roomId);
    } else {
      return NextResponse.json(
        { success: false, message: 'Room not found' },
        { status: 404 },
      );
    }
  }
  room = maybeDraw(room);
  return NextResponse.json({ success: true, data: withTimer(room) });
}
