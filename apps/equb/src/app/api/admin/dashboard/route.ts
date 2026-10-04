import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      demoMode: true,
      service: 'fast-equb-next-api',
      note: 'Admin dashboard metrics (demo)',
    },
  });
}
