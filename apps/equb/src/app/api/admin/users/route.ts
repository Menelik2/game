import { NextRequest, NextResponse } from 'next/server';
import { adminCreate, adminList } from '@/lib/server/admin-users';
import { listDeposits } from '@/lib/wallet/deposits';
import { requireAdmin, sanitizeText } from '@/lib/server/admin-auth';
import { pushAudit } from '@/lib/server/audit';
import { normalizePhone } from '@/lib/password';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

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
          pendingDeposits: deposits.filter(
            (d) => d.status === 'PENDING' || d.status === 'PROCESSING',
          ).length,
        },
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'List failed' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const fullName = sanitizeText(body.fullName || body.name, 80);
    const phoneRaw = String(body.phone || '');
    const phone = normalizePhone(phoneRaw);
    const password = String(body.password || '');
    const balance = Number(body.balance ?? 0);
    const role = body.role === 'admin' ? 'admin' : 'player';

    if (!fullName || fullName.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Full name required' },
        { status: 400 },
      );
    }
    if (!phone) {
      return NextResponse.json(
        { success: false, message: 'Valid phone required (09xxxxxxxx)' },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters' },
        { status: 400 },
      );
    }
    if (!Number.isFinite(balance) || balance < 0 || balance > 10_000_000) {
      return NextResponse.json(
        { success: false, message: 'Invalid balance' },
        { status: 400 },
      );
    }

    const user = await adminCreate({
      fullName,
      phone,
      password,
      balance,
      role,
    });

    pushAudit({
      action: 'admin.user.create',
      entity: 'user',
      entityId: user.id,
      userId: auth.admin.id,
      meta: { phone: user.phone, role: user.role },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Create failed' },
      { status: 400 },
    );
  }
}
