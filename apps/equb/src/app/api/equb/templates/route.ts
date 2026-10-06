import { NextResponse } from 'next/server';
import { buildCatalog, findOpen, withTimer } from '@/lib/server/equb-rooms';
import { listSharedOpen, sharedEnabled } from '@/lib/server/shared-rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  let seatsByTemplate = new Map<string, { seats: number; liveId: string | null; status: string; secondsLeft: number }>();

  if (sharedEnabled()) {
    try {
      const open = await listSharedOpen();
      for (const r of open) {
        seatsByTemplate.set(r.templateId, {
          seats: r.members.length,
          liveId: r.id,
          status: r.status,
          secondsLeft: r.secondsLeft,
        });
      }
    } catch {
      /* fall back to memory */
    }
  }

  const catalog = buildCatalog(9000).map((t) => {
    const shared = seatsByTemplate.get(t.id);
    if (shared) {
      return {
        ...t,
        liveRoomId: shared.liveId,
        seatsTaken: shared.seats,
        status: shared.status,
        secondsLeft: shared.secondsLeft,
      };
    }
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
