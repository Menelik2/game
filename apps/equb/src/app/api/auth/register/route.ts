import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, normalizePhone } from '@/lib/password';
import { dbRegister } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const fullName = String(body.fullName || body.name || '').trim();
    const phoneRaw = String(body.phone || '').trim();
    const password = String(body.password || '');

    if (fullName.length < 2) {
      return NextResponse.json(
        { success: false, message: 'Full name required (min 2 characters)' },
        { status: 400 },
      );
    }

    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Valid Ethiopian phone required. Examples: 09xxxxxxxx or +2519xxxxxxxx',
        },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters' },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    const r = await dbRegister({ fullName, phone, passwordHash });

    if (!r.ok) {
      return NextResponse.json(
        { success: false, message: r.error },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, data: r.user });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || 'Register failed' },
      { status: 500 },
    );
  }
}
