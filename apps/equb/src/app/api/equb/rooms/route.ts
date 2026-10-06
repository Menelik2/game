import { NextResponse } from 'next/server';
import { listRooms } from '@/lib/server/equb-rooms';
import { listSharedOpen, sharedEnabled } from '@/lib/server/shared-rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** List live open rooms so other players can join */
export async function GET() {
  try {
    if (sharedEnabled()) {
      const shared = await listSharedOpen();
      return NextResponse.json({
        success: true,
        data: shared,
        shared: true,
      });
    }
    const mem = listRooms()
      .filter((r) => r.status === 'open' && r.members.length > 0)
      .sort((a, b) => b.members.length - a.members.length);
    return NextResponse.json({ success: true, data: mem, shared: false });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'List failed',
        data: [],
      },
      { status: 200 },
    );
  }
}
