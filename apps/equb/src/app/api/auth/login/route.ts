import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, normalizePhone } from '@/lib/password';
import { dbEnsureAdmin, dbLogin } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Admin bootstrap (server-only env — never shipped to the browser):
 *   ADMIN_PHONE=+2519xxxxxxxx
 *   ADMIN_PASSWORD=your-secret
 * Password is hashed and stored in the database only.
 * Plaintext is never returned in API responses.
 */
async function ensureAdminFromEnv() {
  const phoneRaw = process.env.ADMIN_PHONE || '';
  const password = process.env.ADMIN_PASSWORD || '';
  if (!phoneRaw || !password) return;
  const phone = normalizePhone(phoneRaw) || phoneRaw.trim();
  if (!phone || password.length < 6) return;
  try {
    await dbEnsureAdmin(phone, hashPassword(password));
  } catch {
    /* ignore seed errors */
  }
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

    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      return NextResponse.json(
        { success: false, message: 'Valid phone required (09xxxxxxxx)' },
        { status: 400 },
      );
    }

    if (!password) {
      return NextResponse.json(
        { success: false, message: 'Password required' },
        { status: 400 },
      );
    }

    // Optional one-time seed from Vercel env into DB (hashed)
    await ensureAdminFromEnv();

    const passwordHash = hashPassword(password);
    const r = await dbLogin({ phone, passwordHash });

    if (!r.ok) {
      return NextResponse.json(
        { success: false, message: r.error || 'Invalid phone or password' },
        { status: 401 },
      );
    }

    // Role only from database — never trust client
    const role = r.user.role === 'admin' ? 'admin' : 'player';

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
