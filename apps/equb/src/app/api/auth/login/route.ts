import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, normalizePhone } from '@/lib/password';
import { dbEnsureAdmin, dbLogin } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Seed admin (legacy demo) + production admin phone from owner
const ADMIN_ACCOUNTS: { phone: string; password: string }[] = [
  { phone: '+251900000000', password: 'Admin123!' },
  { phone: '+251918006053', password: 'Admin123!' },
];

function resolveAdminPhone(phoneRaw: string): string | null {
  const digits = phoneRaw.replace(/\D/g, '');
  if (
    digits === '0900000000' ||
    digits === '900000000' ||
    digits === '251900000000' ||
    phoneRaw.trim().toLowerCase() === 'admin'
  ) {
    return '+251900000000';
  }
  if (
    digits === '0918006053' ||
    digits === '918006053' ||
    digits === '251918006053'
  ) {
    return '+251918006053';
  }
  return normalizePhone(phoneRaw);
}

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

    const phone = resolveAdminPhone(phoneRaw);

    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          message: 'Valid phone required (09xxxxxxxx)',
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

    // Ensure seed admins exist (both phones)
    for (const a of ADMIN_ACCOUNTS) {
      try {
        await dbEnsureAdmin(a.phone, hashPassword(a.password));
      } catch {
        /* ignore */
      }
    }

    const passwordHash = hashPassword(password);
    const r = await dbLogin({ phone, passwordHash });

    if (!r.ok) {
      return NextResponse.json(
        { success: false, message: r.error || 'Invalid phone or password' },
        { status: 401 },
      );
    }

    // Promote known admin phones
    let role = r.user.role;
    if (
      r.user.phone === '+251900000000' ||
      r.user.phone === '+251918006053' ||
      role === 'admin'
    ) {
      role = 'admin';
    }

    return NextResponse.json({
      success: true,
      data: {
        id: r.user.id,
        fullName: r.user.fullName,
        phone: r.user.phone,
        balance: r.user.balance,
        referralCode: r.user.referralCode,
        role,
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
