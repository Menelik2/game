import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/server/db-users';
import { isRealMoneyLive, paymentPublicConfig } from '@/lib/payments/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const database = isDbConfigured();
  const payments = paymentPublicConfig();
  return NextResponse.json({
    status: 'ok',
    service: 'fast-equb-next-api',
    equb: true,
    timestamp: new Date().toISOString(),
    database,
    storage: database ? 'supabase' : 'memory',
    demoMode: false,
    realMoneyEnabled: payments.mode === 'real_money',
    realMoneyLive: isRealMoneyLive(),
    paymentProvider: payments.provider,
    payments,
  });
}
