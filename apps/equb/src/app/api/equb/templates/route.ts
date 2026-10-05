import { NextResponse } from 'next/server';
import { buildCatalog, findOpen, withTimer } from '@/lib/server/equb-rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const catalog = buildCatalog(9000).map((t) => {
    const live = findOpen(t.id);
    return {
      ...t,
      liveRoomId: live?.id ?? null,
      seatsTaken: live?.members.length ?? 0,
      status: live?.status ?? 'open',
      secondsLeft: live ? withTimer(live).secondsLeft : 60,
    };
  });
  return NextResponse.json({ success: true, data: catalog });
}
