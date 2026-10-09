import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionUser,
  clearSessionCookie,
} from '@/lib/server/session';
import {
  dbUpdateProfile,
  dbVerifyPassword,
  dbDeleteUser,
} from '@/lib/server/db-profile';
import { hashPassword, normalizePhone } from '@/lib/password';
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

function publicData(user: {
  id: string;
  fullName: string;
  phone: string;
  balance: number;
  referralCode: string;
  role: string;
  banned?: boolean;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    name: user.fullName,
    phone: user.phone,
    balance: user.balance,
    referralCode: user.referralCode,
    role: user.role === 'admin' ? 'admin' : 'player',
    banned: user.banned ?? false,
  };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return withSecurityHeaders(
      NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'Not signed in' },
        { status: 401 },
      ),
    );
  }
  return withSecurityHeaders(
    NextResponse.json({ success: true, data: publicData(user) }),
  );
}

export async function PATCH(req: NextRequest) {
  const tooBig = assertBodySize(req);
  if (tooBig) return withSecurityHeaders(tooBig);
  if (!originAllowed(req)) return withSecurityHeaders(forbiddenOrigin());

  const ip = clientIp(req);
  const rl = rateLimit(`profile-update:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: `Too many updates. Try again in ${rl.retryAfterSec}s.`,
        },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      ),
    );
  }

  const user = await getSessionUser(req);
  if (!user) {
    return withSecurityHeaders(
      NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'Not signed in' },
        { status: 401 },
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

    const fullNameRaw = body.fullName ?? body.name;
    const fullName =
      fullNameRaw !== undefined
        ? sanitizeUserText(fullNameRaw, 80)
        : undefined;
    const currentPassword =
      body.currentPassword !== undefined
        ? String(body.currentPassword || '').slice(0, 128)
        : undefined;
    const newPassword =
      body.newPassword !== undefined
        ? String(body.newPassword || '').slice(0, 128)
        : undefined;

    // Phone is permanent — never allow change after registration
    if (body.phone !== undefined && String(body.phone || '').trim() !== '') {
      const attempted = String(body.phone || '').trim();
      const normalizedAttempt = (() => {
        try {
          return normalizePhone(attempted);
        } catch {
          return null;
        }
      })();
      if (normalizedAttempt && normalizedAttempt !== user.phone) {
        return withSecurityHeaders(
          NextResponse.json(
            {
              success: false,
              message: 'Phone number cannot be changed',
            },
            { status: 403 },
          ),
        );
      }
      if (!normalizedAttempt && attempted !== user.phone) {
        return withSecurityHeaders(
          NextResponse.json(
            {
              success: false,
              message: 'Phone number cannot be changed',
            },
            { status: 403 },
          ),
        );
      }
    }

    if (fullName !== undefined && fullName.length < 2) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'Full name required (min 2 characters)' },
          { status: 400 },
        ),
      );
    }

    if (newPassword !== undefined) {
      if (newPassword.length < 6) {
        return withSecurityHeaders(
          NextResponse.json(
            { success: false, message: 'New password min 6 characters' },
            { status: 400 },
          ),
        );
      }
      if (!currentPassword) {
        return withSecurityHeaders(
          NextResponse.json(
            {
              success: false,
              message: 'Current password required to change password',
            },
            { status: 400 },
          ),
        );
      }
      const ok = await dbVerifyPassword(user.id, hashPassword(currentPassword));
      if (!ok) {
        return withSecurityHeaders(
          NextResponse.json(
            { success: false, message: 'Current password is incorrect' },
            { status: 403 },
          ),
        );
      }
    }

    const result = await dbUpdateProfile(user.id, {
      fullName,
      passwordHash: newPassword ? hashPassword(newPassword) : undefined,
    });

    if (!result.ok) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: result.error },
          { status: 400 },
        ),
      );
    }

    return withSecurityHeaders(
      NextResponse.json({
        success: true,
        message: 'Profile updated',
        data: publicData(result.user),
      }),
    );
  } catch (e: unknown) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: e instanceof Error ? e.message : 'Update failed',
        },
        { status: 500 },
      ),
    );
  }
}

export async function DELETE(req: NextRequest) {
  const tooBig = assertBodySize(req);
  if (tooBig) return withSecurityHeaders(tooBig);
  if (!originAllowed(req)) return withSecurityHeaders(forbiddenOrigin());

  const ip = clientIp(req);
  const rl = rateLimit(`profile-delete:${ip}`, 5, 60_000);
  if (!rl.ok) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: `Too many attempts. Try again in ${rl.retryAfterSec}s.`,
        },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      ),
    );
  }

  const user = await getSessionUser(req);
  if (!user) {
    return withSecurityHeaders(
      NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'Not signed in' },
        { status: 401 },
      ),
    );
  }

  if (user.role === 'admin') {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message:
            'Admin accounts cannot be deleted from profile. Use admin tools.',
        },
        { status: 403 },
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
    const password = String(body.password || '').slice(0, 128);
    if (password.length < 1) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'Password required to delete account' },
          { status: 400 },
        ),
      );
    }

    const ok = await dbVerifyPassword(user.id, hashPassword(password));
    if (!ok) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'Password is incorrect' },
          { status: 403 },
        ),
      );
    }

    const result = await dbDeleteUser(user.id);
    if (!result.ok) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: result.error },
          { status: 400 },
        ),
      );
    }

    const res = NextResponse.json({
      success: true,
      message: 'Account deleted',
    });
    clearSessionCookie(res);
    return withSecurityHeaders(res);
  } catch (e: unknown) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: e instanceof Error ? e.message : 'Delete failed',
        },
        { status: 500 },
      ),
    );
  }
}
