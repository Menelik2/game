import { NextRequest, NextResponse } from 'next/server';
import { dbGetUser, type DbUser } from '@/lib/server/db-users';

const ADMIN_PHONE_DIGITS = new Set([
  '900000000',
  '251900000000',
  '918006053',
  '251918006053',
]);

function digits(p?: string) {
  return (p || '').replace(/\D/g, '');
}

export function isAdminRole(user: { role?: string; phone?: string } | null): boolean {
  if (!user) return false;
  if (String(user.role || '').toLowerCase() === 'admin') return true;
  const d = digits(user.phone);
  return ADMIN_PHONE_DIGITS.has(d) || d.endsWith('900000000') || d.endsWith('918006053');
}

/** Extract caller id from headers (never trust body alone for auth). */
export function extractCallerId(req: NextRequest): string {
  return (
    req.headers.get('x-user-id') ||
    req.headers.get('x-admin-user-id') ||
    ''
  ).trim();
}

export type AdminAuthOk = { ok: true; admin: DbUser };
export type AdminAuthFail = { ok: false; response: NextResponse };

/**
 * Server-side admin gate for all /api/admin/* mutations and reads.
 * Requires x-user-id of a user with role admin (or allowlisted admin phone).
 */
export async function requireAdmin(req: NextRequest): Promise<AdminAuthOk | AdminAuthFail> {
  const userId = extractCallerId(req);
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Admin authentication required (sign in first)',
        },
        { status: 401 },
      ),
    };
  }

  const user = await dbGetUser(userId);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, code: 'UNAUTHORIZED', message: 'Unknown admin session' },
        { status: 401 },
      ),
    };
  }

  if (user.banned) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, code: 'BANNED', message: 'Account banned' },
        { status: 403 },
      ),
    };
  }

  if (!isAdminRole(user)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: 'FORBIDDEN',
          message: 'Administrator privileges required',
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, admin: user };
}

/** Sanitize free-text admin notes / reasons (strip tags, limit length). */
export function sanitizeText(raw: unknown, max = 500): string {
  return String(raw ?? '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F]/g, '')
    .trim()
    .slice(0, max);
}
