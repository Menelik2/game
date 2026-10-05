import { NextRequest, NextResponse } from 'next/server';
import { listAudit, auditCount } from '@/lib/server/audit-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Only GET is exported — helpers live in @/lib/server/audit-log */
export async function GET(req: NextRequest) {
  const limit = Math.min(
    100,
    Number(req.nextUrl.searchParams.get('limit')) || 50,
  );
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const all = listAudit(200);
  const total = auditCount();
  const start = (page - 1) * limit;
  const items = all.slice(start, start + limit).map((a) => ({
    id: a.id,
    action: a.action,
    entity: a.entity ?? null,
    entityId: a.entityId ?? null,
    userId: a.userId ?? null,
    createdAt: a.createdAt || new Date(a.at).toISOString(),
  }));

  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      meta: {
        page,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  });
}
