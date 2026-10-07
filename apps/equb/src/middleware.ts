import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware — security headers + block obvious probe paths.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname.toLowerCase();

  // Block common scanner / exploit probes
  const blocked =
    path.includes('wp-admin') ||
    path.includes('wp-login') ||
    path.includes('phpmyadmin') ||
    path.includes('.env') ||
    path.includes('xmlrpc') ||
    path.endsWith('.php') ||
    path.includes('actuator') ||
    path.includes('../');

  if (blocked) {
    return new NextResponse('Not found', { status: 404 });
  }

  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  );

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
