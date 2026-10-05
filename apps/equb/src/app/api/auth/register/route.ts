import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, normalizePhone } from '@/lib/password';
import { dbRegister, isDbConfigured } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      {
        success: false,
        code: 'DB_NOT_CONFIGURED',
        message:
          'Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY and run migration 20261005_app_users.sql',
      },
      { status: 503 },
    );
  }
  const body = await req.json().catch(() => ({}));
  const fullName = String(body.fullName || body.name || '').trim();
  const phone = normalizePhone(String(body.phone || ''));
  const password = String(body.password || '');
  if (fullName.length < 2) {
    return NextResponse.json({ success: false, message: 'Full name required' }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ success: false, message: 'Valid phone required' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ success: false, message: 'Password min 6' }, { status: 400 });
  }
  const passwordHash = await hashPassword(password);
  const r = await dbRegister({ fullName, phone, passwordHash });
  if (!r.ok) {
    return NextResponse.json({ success: false, message: r.error }, { status: 400 });
  }
  return NextResponse.json({ success: true, data: r.user });
}
