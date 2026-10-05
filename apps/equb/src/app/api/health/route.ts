import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'fast-equb-next-api',
    equb: true,
    timestamp: new Date().toISOString(),
    demoMode: true,
  });
}
