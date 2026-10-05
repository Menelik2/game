import { NextRequest, NextResponse } from 'next/server';
import { adminCreate, adminList } from '@/lib/server/admin-users';
import { listDeposits } from '@/lib/wallet/deposits';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const users = await adminList();
    const deposits = listDeposits();
    return NextResponse.json({
      success: true,
      data: {
        users,
        stats: {
          users: users.length,
          admins: users.filter((u) => u.role === 'admin').length,
          banned: users.filter((u) => u.banned).length,
          totalBalance: users.reduce((s, u) => s + Number(u.balance || 0), 0),
          deposits: deposits.length,
          pendingDeposits: deposits.filter((d) => d.status === 'PENDING' || d.status === 'PROCESSING').length,
        },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'List failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const user = await adminCreate(body);
    return NextResponse.json({ success: true, data: user });
  } catch (e: any) {
    return NextResponse.json({ success: false, message: e?.message || 'Create failed' }, { status: 400 });
  }
}
