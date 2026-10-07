import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { withSecurityHeaders } from '@/lib/server/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Current user from signed session cookie (not from client-supplied id). */
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
    NextResponse.json({
      success: true,
      data: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        balance: user.balance,
        referralCode: user.referralCode,
        role: user.role === 'admin' ? 'admin' : 'player',
        banned: user.banned ?? false,
      },
    }),
  );
}
