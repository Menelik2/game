import { NextRequest, NextResponse } from 'next/server';
import { dbListUsers } from '@/lib/server/db-users';
import { requireAdmin } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const users = await dbListUsers().catch(() => []);
    return NextResponse.json({
      success: true,
      data: {
        demoMode: process.env.REAL_MONEY_ENABLED !== 'true',
        service: 'fast-equb-next-api',
        registeredUsers: users.length,
        adminId: auth.admin.id,
        note: 'Admin dashboard metrics',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({
      success: true,
      data: {
        demoMode: true,
        service: 'fast-equb-next-api',
        registeredUsers: 0,
        error: e instanceof Error ? e.message : 'error',
      },
    });
  }
}
