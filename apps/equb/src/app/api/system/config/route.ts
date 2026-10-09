import { NextResponse } from 'next/server';
import { getPublicPlatformConfig } from '@/lib/server/platform-settings';
import { withSecurityHeaders } from '@/lib/server/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public config: banner, maintenance, deposit limits — no secrets */
export async function GET() {
  return withSecurityHeaders(
    NextResponse.json({
      success: true,
      data: getPublicPlatformConfig(),
    }),
  );
}
