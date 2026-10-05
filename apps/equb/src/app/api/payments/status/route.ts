import { NextResponse } from 'next/server';
import { paymentPublicConfig } from '@/lib/payments/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ success: true, data: paymentPublicConfig() });
}
