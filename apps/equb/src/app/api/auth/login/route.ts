import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, normalizePhone } from '@/lib/password';
import { dbEnsureAdmin, dbLogin, isDbConfigured } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';

const ADMIN_PHONE = '+251900000000';
const ADMIN_PASSWORD = 'Admin123!';

export async function POST(req: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { success: false, code: 'DB_NOT_CONFIGURED', message: 'Database not configured' },
      { status: 503 },
    );
  }
  const body = await req.json().catch(() => ({}));
  let phone = normalizePhone(String(body.phone || ''));
  if (!phone && String(body.phone || '').replace(/\s/g, '') === '0900000000') {
    phone = ADMIN_PHONE;
  }
  const password = String(body.password || '');
  if (!phone || !password) {
    return NextResponse.json({ success: false, message: 'Phone and password required' }, { status: 400 });
  }
  const adminHash = await hashPassword(ADMIN_PASSWORD);
  await dbEnsureAdmin(ADMIN_PHONE, adminHash).catch(() => null);
  const passwordHash = await hashPassword(password);
  const r = await dbLogin({ phone, passwordHash });
  if (!r.ok) {
    return NextResponse.json({ success: false, message: r.error }, { status: 401 });
  }
  return NextResponse.json({ success: true, data: r.user });
}
