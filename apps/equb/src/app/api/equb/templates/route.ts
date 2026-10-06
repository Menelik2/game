import { NextResponse } from 'next/server';
import { buildRoomCatalog } from '@/lib/equb-math';
import { sharedEnabled } from '@/lib/server/shared-rooms';
import { listSharedOpen } from '@/lib/server/shared-rooms-list';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const templates = buildRoomCatalog({ maxPrize: 9000 });
  let open: unknown[] = [];
  try {
    if (sharedEnabled()) open = await listSharedOpen();
  } catch {
    open = [];
  }
  return NextResponse.json({ success: true, data: templates, open });
}
