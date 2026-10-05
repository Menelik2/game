import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, normalizePhone } from '@/lib/password';
import { dbEnsureAdmin, dbLogin } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_PHONE = '+251900000000';
const ADMIN_PASSWORD = 'Admin123!';

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const phoneRaw = String(body.phone ?? body.username ?? '');
    const password = String(body.password ?? '');

    let phone = normalizePhone(phoneRaw);
    const digits = phoneRaw.replace(/\D/g, '');
    if (
      !phone &&
      (digits === '0900000000' ||
        digits === '900000000' ||
        phoneRaw.trim() === 'admin')
    ) {
      phone = ADMIN_PHONE;
    }

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Valid phone required (09xxxxxxxx). Admin: 0900000000 / Admin123!',
        },
        { status: 400 },
      );
    }

    if (!password) {
      return NextResponse.json(
        { success: false, message: 'Password required' },
        { status: 400 },
      );
    }

    try {
      await dbEnsureAdmin(ADMIN_PHONE, hashPassword(ADMIN_PASSWORD));
    } catch {
      /* ignore */
    }

    const passwordHash = hashPassword(password);
    const r = await dbLogin({ phone, passwordHash });

    if (!r.ok) {
      return NextResponse.json(
        { success: false, message: r.error || 'Invalid phone or password' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: r.user.id,
        fullName: r.user.fullName,
        phone: r.user.phone,
        balance: r.user.balance,
        referralCode: r.user.referralCode,
        role: r.user.role,
        banned: r.user.banned ?? false,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Login failed';
    console.error('[auth/login]', message);
    return NextResponse.json(
      { success: false, message: `Login error: ${message}` },
      { status: 500 },
    );
  }
}
