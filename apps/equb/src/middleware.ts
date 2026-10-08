import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Edge middleware — headers + block scanners / path traversal */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname.toLowerCase();
  const raw = req.nextUrl.pathname;

  const blocked =
    path.includes('wp-admin') ||
    path.includes('wp-login') ||
    path.includes('phpmyadmin') ||
    path.includes('.env') ||
    path.includes('xmlrpc') ||
    path.endsWith('.php') ||
    path.endsWith('.asp') ||
    path.endsWith('.aspx') ||
    path.includes('actuator') ||
    path.includes('../') ||
    path.includes('%2e%2e') ||
    path.includes('..%2f') ||
    path.includes('/.git') ||
    path.includes('/.svn') ||
    path.includes('cgi-bin') ||
    path.includes('shell') ||
    path.includes('eval-stdin') ||
    path.includes('vendor/phpunit') ||
    path.includes('manager/html') ||
    path.includes('solr/') ||
    path.includes('debug/default') ||
    path.includes('config.json') ||
    raw.includes('\0');

  if (blocked) {
    return new NextResponse('Not found', { status: 404 });
  }

  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), display-capture=()',
  );
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload',
  );
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
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  );

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
