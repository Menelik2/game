/**
 * Server-side sessions: HMAC-signed token in httpOnly cookie.
 * Client cannot forge user id — cookie is signed with SESSION_SECRET.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dbGetUser, type DbUser } from '@/lib/server/db-users';

export const SESSION_COOKIE = 'equb_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export type SessionPayload = {
  sub: string; // user id
  role: 'player' | 'admin';
  iat: number;
  exp: number;
};

function secret(): string {
  return (
    process.env.SESSION_SECRET ||
    process.env.PASSWORD_PEPPER ||
    process.env.ADMIN_PASSWORD ||
    'equb-dev-session-change-me'
  );
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, 'utf8');
  return b
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function sign(data: string): string {
  return b64url(createHmac('sha256', secret()).update(data).digest());
}

export function createSessionToken(user: {
  id: string;
  role?: string;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: user.id,
    role: user.role === 'admin' ? 'admin' : 'player',
    iat: now,
    exp: now + MAX_AGE_SEC,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = sign(body);
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as SessionPayload;
    if (!payload?.sub || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readSessionCookie(req: NextRequest): SessionPayload | null {
  const raw = req.cookies.get(SESSION_COOKIE)?.value;
  return verifySessionToken(raw);
}

export function sessionCookieOptions(maxAge = MAX_AGE_SEC) {
  const secure =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.FORCE_SECURE_COOKIE === '1';
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function attachSessionCookie(
  res: NextResponse,
  user: { id: string; role?: string },
): NextResponse {
  const token = createSessionToken(user);
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
  return res;
}

/** Resolve authenticated user from session cookie (preferred) or legacy header. */
export async function getSessionUser(
  req: NextRequest,
): Promise<DbUser | null> {
  const sess = readSessionCookie(req);
  if (sess?.sub) {
    const user = await dbGetUser(sess.sub);
    if (user && !user.banned) return user;
    return null;
  }

  // Legacy fallback during migration — disable with DISABLE_X_USER_ID=1
  if (process.env.DISABLE_X_USER_ID === '1') return null;
  const legacy =
    req.headers.get('x-user-id') || req.headers.get('x-admin-user-id') || '';
  if (!legacy.trim()) return null;
  const user = await dbGetUser(legacy.trim());
  if (user && !user.banned) return user;
  return null;
}

export type AuthOk = { ok: true; user: DbUser };
export type AuthFail = { ok: false; response: NextResponse };

export async function requireUser(
  req: NextRequest,
): Promise<AuthOk | AuthFail> {
  const user = await getSessionUser(req);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: 'UNAUTHORIZED',
          message: 'Sign in required (valid session cookie)',
        },
        { status: 401 },
      ),
    };
  }
  return { ok: true, user };
}
