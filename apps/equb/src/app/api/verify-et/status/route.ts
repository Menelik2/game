import { NextResponse } from 'next/server';
import { verifyEtConfig } from '@/lib/verify-et/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function backendBase() {
  return (
    process.env.VERIFY_ET_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'https://game-rho-eight-15.vercel.app'
  ).replace(/\/$/, '');
}

/** Safe status — checks local key, then backend key. */
export async function GET() {
  const c = verifyEtConfig();
  if (c.configured) {
    return NextResponse.json({
      success: true,
      configured: true,
      source: 'frontend',
      baseUrl: c.baseUrl,
      merchantPhone: c.settlementAccount,
      merchantName: c.merchantName,
      keyPresent: true,
      keyHint: c.keyHint,
      message: 'VERIFY_ET_API_KEY is loaded on frontend (abelgame).',
    });
  }

  try {
    const res = await fetch(`${backendBase()}/api/verify-et/status`, {
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (json?.configured) {
      return NextResponse.json({
        success: true,
        configured: true,
        source: 'backend',
        baseUrl: json.baseUrl || 'https://verify.et',
        merchantPhone: json.merchantPhone || c.settlementAccount,
        merchantName: json.merchantName || c.merchantName,
        keyPresent: true,
        keyHint: json.keyHint || null,
        message:
          'VERIFY_ET_API_KEY is loaded on backend (game-rho-eight-15). Wallet verify will proxy there.',
        backend: backendBase(),
      });
    }
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    success: true,
    configured: false,
    source: 'none',
    baseUrl: c.baseUrl,
    merchantPhone: c.settlementAccount,
    merchantName: c.merchantName,
    keyPresent: false,
    keyHint: null,
    message:
      'No VERIFY_ET_API_KEY on frontend or backend. Add it on game-rho-eight-15 (backend) and Redeploy, or on abelgame (frontend).',
    backend: backendBase(),
  });
}
