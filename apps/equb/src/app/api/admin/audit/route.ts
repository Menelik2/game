import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type AuditEntry = {
  id: string;
  action: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  at: number;
};

const g = globalThis as unknown as { __nextAudit?: AuditEntry[] };
if (!g.__nextAudit) g.__nextAudit = [];

export function pushAudit(
  entry: Omit<AuditEntry, 'id' | 'at'> & { id?: string; at?: number },
) {
  g.__nextAudit!.unshift({
    id: entry.id || `a_${Date.now().toString(36)}`,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    userId: entry.userId,
    metadata: entry.metadata,
    at: entry.at || Date.now(),
  });
  if (g.__nextAudit!.length > 200) g.__nextAudit!.length = 200;
}

export async function GET(req: NextRequest) {
  const limit = Math.min(
    100,
    Number(req.nextUrl.searchParams.get('limit')) || 50,
  );
  const items = (g.__nextAudit || []).slice(0, limit);
  return NextResponse.json({
    success: true,
    data: { items, total: (g.__nextAudit || []).length },
  });
}
