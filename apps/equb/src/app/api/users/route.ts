import { NextResponse } from 'next/server';
import { dbListUsers } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const items = await dbListUsers();
    return NextResponse.json({
      success: true,
      data: { items, total: items.length },
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || 'List failed' },
      { status: 500 },
    );
  }
}
