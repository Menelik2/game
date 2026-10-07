import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { listAudit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const limit = Math.min(100, Number(req.nextUrl.searchParams.get('limit')) || 50);
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const data = listAudit(limit, page);

  return NextResponse.json({
    success: true,
    data: {
      items: data.items,
      total: data.total,
      meta: { page: data.page, total: data.total, totalPages: data.totalPages },
    },
  });
}
