import { NextResponse } from 'next/server';
import { listRooms } from '@/lib/server/equb-rooms';
import { sharedEnabled, getShared } from '@/lib/server/shared-rooms';
import { listAllSharedRooms } from '@/lib/server/shared-rooms-list';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Popular templates always kept warm so LIVE list is never empty after deploys. */
const WARM = ['equb-5-500', 'equb-10-1000', 'equb-10-500', 'equb-20-2000'];

export async function GET() {
  try {
    if (sharedEnabled()) {
      // Refresh / open-cycle popular templates so join stays available
      await Promise.all(
        WARM.map((id) => getShared(id).catch(() => null)),
      );

      const all = await listAllSharedRooms();
      const open = all
        .filter((r) => r.status === 'open' && !r.adminClosed)
        .sort((a, b) => {
          const am = a.members?.length || 0;
          const bm = b.members?.length || 0;
          if (bm !== am) return bm - am;
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        });

      return NextResponse.json({
        success: true,
        data: open,
        shared: true,
        live: true,
      });
    }

    // Memory fallback only when DB is not configured
    const mem = listRooms()
      .filter((r) => r.status === 'open')
      .sort((a, b) => b.members.length - a.members.length);
    return NextResponse.json({
      success: true,
      data: mem,
      shared: false,
      live: false,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'List failed',
        data: [],
        shared: false,
        live: false,
      },
      { status: 200 },
    );
  }
}
