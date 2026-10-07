import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/server/session';
import { withSecurityHeaders } from '@/lib/server/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Signed out' });
  clearSessionCookie(res);
  return withSecurityHeaders(res);
}

export async function GET() {
  return POST();
}
