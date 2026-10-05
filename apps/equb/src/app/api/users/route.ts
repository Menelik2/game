import { NextResponse } from 'next/server';
import { dbListUsers, isDbConfigured } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  try {
    const items = await dbListUsers();
    return NextResponse.json({ success: true, data: { items, total: items.length } });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message }, { status: 500 });
  }
}
