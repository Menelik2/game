import { NextRequest, NextResponse } from 'next/server';
import {
  ensureOpen,
  getRoom,
  maybeDraw,
  withTimer,
} from '@/lib/server/equb-rooms';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let room = getRoom(id);
  if (!room) {
    if (/^equb-\d+-\d+$/.test(id)) {
      room = ensureOpen(id);
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
