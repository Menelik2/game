import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, normalizePhone } from '@/lib/password';
import { dbEnsureAdmin, dbLogin } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';

const ADMIN_PHONE = '+251900000000';
const ADMIN_PASSWORD = 'Admin123!';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let phone = normalizePhone(String(body.phone || ''));
    const digits = String(body.phone || '').replace(/\D/g, '');
    if (!phone && (digits === '0900000000' || digits === '900000000')) {
      phone = ADMIN_PHONE;
    }
    const password = String(body.password || '');

    if (!phone || !password) {
      return NextResponse.json(
        { success: false, message: 'Phone and password required' },
        { status: 400 },
      );
    }

    const adminHash = await hashPassword(ADMIN_PASSWORD);
    await dbEnsureAdmin(ADMIN_PHONE, adminHash).catch(() => null);

    const passwordHash = await hashPassword(password);
    const r = await dbLogin({ phone, passwordHash });
    if (!r.ok) {
      return NextResponse.json(
        { success: false, message: r.error },
        { status: 401 },
      );
    }
    return NextResponse.json({ success: true, data: r.user });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || 'Login failed' },
      { status: 500 },
    );
  }
}
