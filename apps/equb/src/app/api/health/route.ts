import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const database = isDbConfigured();
  return NextResponse.json({
    status: 'ok',
    service: 'fast-equb-next-api',
    equb: true,
    timestamp: new Date().toISOString(),
    database,
    storage: database ? 'supabase' : 'memory',
    demoMode: !database,
  });
}
