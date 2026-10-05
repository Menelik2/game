import { NextResponse } from 'next/server';
import { verifyEtConfig } from '@/lib/verify-et/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Safe status for debugging env setup (does not leak the full API key). */
export async function GET() {
  const c = verifyEtConfig();
  return NextResponse.json({
    success: true,
    configured: c.configured,
    baseUrl: c.baseUrl,
    merchantPhone: c.settlementAccount,
    merchantName: c.merchantName,
    keyPresent: Boolean(c.apiKey),
    keyHint: c.keyHint,
    message: c.configured
      ? 'VERIFY_ET_API_KEY is loaded. You can verify Telebirr deposits.'
      : 'VERIFY_ET_API_KEY is not visible to this deployment. Add it under Production + Preview, then Redeploy.',
  });
}
