import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, normalizePhone } from '@/lib/password';
import { dbEnsureAdmin, dbLogin } from '@/lib/server/db-users';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';
import {
  assertBodySize,
  originAllowed,
  forbiddenOrigin,
  withSecurityHeaders,
} from '@/lib/server/security';
import { attachSessionCookie } from '@/lib/server/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function ensureAdminFromEnv() {
  const phoneRaw = process.env.ADMIN_PHONE || '';
  const password = process.env.ADMIN_PASSWORD || '';
  if (!phoneRaw || !password) return;
  const phone = normalizePhone(phoneRaw) || phoneRaw.trim();
  if (!phone || password.length < 6) return;
  try {
    await dbEnsureAdmin(phone, hashPassword(password));
  } catch {
    /* ignore */
  }
}

export async function POST(req: NextRequest) {
  const tooBig = assertBodySize(req);
  if (tooBig) return withSecurityHeaders(tooBig);
  if (!originAllowed(req)) return withSecurityHeaders(forbiddenOrigin());

  const ip = clientIp(req);
  const rl = rateLimit(`login:${ip}`, 12, 60_000);
  if (!rl.ok) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: `Too many login attempts. Try again in ${rl.retryAfterSec}s.`,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        },
      ),
    );
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const phoneRaw = String(body.phone ?? body.username ?? '').slice(0, 32);
    const password = String(body.password ?? '').slice(0, 128);
    const phone = normalizePhone(phoneRaw);
    if (!phone || !password) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'Invalid phone or password' },
          { status: 401 },
        ),
      );
    }

    const rlPhone = rateLimit(`login-phone:${phone}`, 8, 60_000);
    if (!rlPhone.ok) {
      return withSecurityHeaders(
        NextResponse.json(
          {
            success: false,
            message: `Too many attempts for this number. Wait ${rlPhone.retryAfterSec}s.`,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(rlPhone.retryAfterSec) },
          },
        ),
      );
    }

    await ensureAdminFromEnv();
    const r = await dbLogin({ phone, passwordHash: hashPassword(password) });

    if (!r.ok) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'Invalid phone or password' },
          { status: 401 },
        ),
      );
    }

    if (r.user.banned) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'Account suspended. Contact support.' },
          { status: 403 },
        ),
      );
    }

    const role = r.user.role === 'admin' ? 'admin' : 'player';
    const res = NextResponse.json({
      success: true,
      data: {
        id: r.user.id,
        fullName: r.user.fullName,
        phone: r.user.phone,
        balance: r.user.balance,
        referralCode: r.user.referralCode,
        role,
        banned: false,
      },
    });
    attachSessionCookie(res, { id: r.user.id, role });
    return withSecurityHeaders(res);
  } catch (e: unknown) {
    console.error('[auth/login]', e instanceof Error ? e.message : e);
    return withSecurityHeaders(
      NextResponse.json(
        { success: false, message: 'Login failed. Please try again.' },
        { status: 500 },
      ),
    );
  }
}
