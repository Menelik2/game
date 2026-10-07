import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, normalizePhone } from '@/lib/password';
import { dbRegister, isDbConfigured } from '@/lib/server/db-users';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';
import {
  assertBodySize,
  originAllowed,
  forbiddenOrigin,
  sanitizeUserText,
  withSecurityHeaders,
} from '@/lib/server/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const tooBig = assertBodySize(req);
  if (tooBig) return withSecurityHeaders(tooBig);
  if (!originAllowed(req)) return withSecurityHeaders(forbiddenOrigin());

  const ip = clientIp(req);
  const rl = rateLimit(`register:${ip}`, 5, 60_000); // 5 / minute / IP
  if (!rl.ok) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: `Too many registrations. Try again in ${rl.retryAfterSec}s.`,
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

    const fullName = sanitizeUserText(body.fullName || body.name, 80);
    const phoneRaw = String(body.phone || '').slice(0, 32);
    const password = String(body.password || '').slice(0, 128);

    // Reject role escalation from client
    if (body.role === 'admin' || body.isAdmin) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'Invalid registration request' },
          { status: 400 },
        ),
      );
    }

    if (fullName.length < 2) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'Full name required (min 2 characters)' },
          { status: 400 },
        ),
      );
    }

    const phone = normalizePhone(phoneRaw);
    if (!phone) {
      return withSecurityHeaders(
        NextResponse.json(
          {
            success: false,
            message:
              'Valid Ethiopian phone required. Examples: 09xxxxxxxx or +2519xxxxxxxx',
          },
          { status: 400 },
        ),
      );
    }

    if (password.length < 6) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'Password must be at least 6 characters' },
          { status: 400 },
        ),
      );
    }

    // Disallow weak passwords that are pure digits shorter than 8
    if (/^\d{1,7}$/.test(password)) {
      return withSecurityHeaders(
        NextResponse.json(
          {
            success: false,
            message: 'Choose a stronger password (not only short digits).',
          },
          { status: 400 },
        ),
      );
    }

    const r = await dbRegister({
      fullName,
      phone,
      passwordHash: hashPassword(password),
    });

    if (!r.ok) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: r.error },
          { status: 400 },
        ),
      );
    }

    // Never return password hash; force player role
    const user = {
      ...r.user,
      role: 'player' as const,
    };

    return withSecurityHeaders(
      NextResponse.json({
        success: true,
        data: user,
        storage: r.storage,
        database: isDbConfigured(),
      }),
    );
  } catch (e: unknown) {
    console.error('[auth/register]', e instanceof Error ? e.message : e);
    return withSecurityHeaders(
      NextResponse.json(
        { success: false, message: 'Registration failed. Please try again.' },
        { status: 500 },
      ),
    );
  }
}
