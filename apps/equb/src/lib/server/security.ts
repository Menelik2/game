import { NextRequest, NextResponse } from 'next/server';

const MAX_JSON_BYTES = 32_768; // 32 KB

/** Reject oversized bodies early. */
export function assertBodySize(req: NextRequest): NextResponse | null {
  const len = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(len) && len > MAX_JSON_BYTES) {
    return NextResponse.json(
      { success: false, message: 'Request too large' },
      { status: 413 },
    );
  }
  return null;
}

/** Strip control chars / angle brackets from free text. */
export function sanitizeUserText(raw: unknown, max = 120): string {
  return String(raw ?? '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

/** Optional origin allowlist for state-changing API (set CORS_ALLOWED_ORIGINS). */
export function originAllowed(req: NextRequest): boolean {
  const allow = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allow.length === 0) return true; // not configured → allow (same-origin app)
  const origin = req.headers.get('origin') || '';
  if (!origin) return true; // same-origin / non-browser
  return allow.some((a) => origin === a || origin.endsWith(a.replace(/^https?:\/\//, '')));
}

export function forbiddenOrigin(): NextResponse {
  return NextResponse.json(
    { success: false, message: 'Origin not allowed' },
    { status: 403 },
  );
}

/** Standard security headers for API responses. */
export function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
