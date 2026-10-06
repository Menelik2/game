import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, normalizePhone } from '@/lib/password';
import { dbResetPassword } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const phoneRaw = String(body.phone ?? '');
    const fullName = String(body.fullName ?? body.full_name ?? '').trim();
    const newPassword = String(body.newPassword ?? body.password ?? '');

    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      return NextResponse.json(
        { success: false, message: 'Valid phone required (09xxxxxxxx)' },
        { status: 400 },
      );
    }
    if (fullName.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Full name required to verify account' },
        { status: 400 },
      );
    }
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'New password must be at least 6 characters' },
        { status: 400 },
      );
    }

    const passwordHash = hashPassword(newPassword);
    const r = await dbResetPassword({ phone, fullName, passwordHash });

    if (!r.ok) {
      return NextResponse.json(
        { success: false, message: r.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated. You can log in now.',
      data: {
        id: r.user.id,
        fullName: r.user.fullName,
        phone: r.user.phone,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Reset failed';
    console.error('[auth/forgot-password]', message);
    return NextResponse.json(
      { success: false, message },
      { status: 500 },
    );
  }
}
