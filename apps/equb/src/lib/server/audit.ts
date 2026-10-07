/** In-memory audit trail for admin actions (no route exports). */

export type AuditEntry = {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  userId: string | null;
  meta?: Record<string, unknown>;
  createdAt: string;
};

const MAX = 500;
const entries: AuditEntry[] = [];

export function pushAudit(input: {
  action: string;
  entity?: string | null;
  entityId?: string | null;
  userId?: string | null;
  meta?: Record<string, unknown>;
}): AuditEntry {
  const row: AuditEntry = {
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action: String(input.action).slice(0, 120),
    entity: input.entity ? String(input.entity).slice(0, 80) : null,
    entityId: input.entityId ? String(input.entityId).slice(0, 80) : null,
    userId: input.userId ? String(input.userId).slice(0, 80) : null,
    meta: input.meta,
    createdAt: new Date().toISOString(),
  };
  entries.unshift(row);
  if (entries.length > MAX) entries.length = MAX;
  return row;
}

export function listAudit(limit = 50, page = 1): {
  items: AuditEntry[];
  total: number;
  page: number;
  totalPages: number;
} {
  const total = entries.length;
  const safeLimit = Math.min(100, Math.max(1, limit));
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * safeLimit;
  return {
    items: entries.slice(start, start + safeLimit),
    total,
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}
