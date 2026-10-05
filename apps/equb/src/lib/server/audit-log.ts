/** Server audit log — import from here, never from a route.ts */

export type AuditEntry = {
  id: string;
  action: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  at: number;
  createdAt?: string;
};

const g = globalThis as unknown as { __nextAudit?: AuditEntry[] };
if (!g.__nextAudit) g.__nextAudit = [];

export function recordAudit(
  entry: Omit<AuditEntry, 'id' | 'at'> & { id?: string; at?: number },
) {
  const at = entry.at || Date.now();
  g.__nextAudit!.unshift({
    id: entry.id || `a_${Date.now().toString(36)}`,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    userId: entry.userId,
    metadata: entry.metadata,
    at,
    createdAt: new Date(at).toISOString(),
  });
  if (g.__nextAudit!.length > 200) g.__nextAudit!.length = 200;
}

/** @deprecated use recordAudit */
export const pushAudit = recordAudit;

export function listAudit(limit = 50): AuditEntry[] {
  return (g.__nextAudit || []).slice(0, limit);
}

export function auditCount(): number {
  return g.__nextAudit?.length || 0;
}
