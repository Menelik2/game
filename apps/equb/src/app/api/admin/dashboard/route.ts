import { NextResponse } from 'next/server';
import { dbListUsers } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const users = await dbListUsers().catch(() => []);
    return NextResponse.json({
      success: true,
      data: {
        demoMode: true,
        service: 'fast-equb-next-api',
        registeredUsers: users.length,
        note: 'Admin dashboard metrics',
      },
    });
  } catch (e: any) {
    return NextResponse.json({
      success: true,
      data: {
        demoMode: true,
        service: 'fast-equb-next-api',
        registeredUsers: 0,
        error: e?.message,
      },
    });
  }
}
