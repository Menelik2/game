import type { AmlFinding, RiskContext } from '../aml.types';

export function evaluateMultiAccount(
  ctx: RiskContext,
  /** Other userIds sharing device or IP */
  linkedUserIds: string[],
): AmlFinding[] {
  const findings: AmlFinding[] = [];
  const others = linkedUserIds.filter((id) => id !== ctx.userId);

  if (ctx.deviceFingerprint && others.length >= 2) {
    findings.push({
      rule: 'MULTI_ACCOUNT_DEVICE',
      severity: others.length >= 4 ? 'CRITICAL' : 'HIGH',
      summary: `Device linked to ${others.length + 1} accounts`,
      evidence: { device: ctx.deviceFingerprint.slice(0, 12), linkedUserIds: others },
      blockOperation: true,
    });
  }

  if (ctx.ip && others.length >= 3) {
    findings.push({
      rule: 'MULTI_ACCOUNT_IP',
      severity: 'MEDIUM',
      summary: `IP associated with ${others.length + 1} accounts`,
      evidence: { linkedUserIds: others },
      blockOperation: false,
    });
  }

  return findings;
}
