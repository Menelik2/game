import { NextRequest, NextResponse } from 'next/server';
import { dbGetUser, isDbConfigured } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });
  }
  const user = await dbGetUser(id);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: user });
}
