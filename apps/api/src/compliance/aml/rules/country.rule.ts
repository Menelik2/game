import type { AmlFinding, RiskContext } from '../aml.types';

/** ISO countries blocked for real-money by default (extend via env) */
const DEFAULT_BLOCKED = new Set(['KP', 'IR', 'SY', 'CU']);

export function evaluateCountry(
  ctx: RiskContext,
  blockedCountries: Set<string> = DEFAULT_BLOCKED,
): AmlFinding[] {
  const findings: AmlFinding[] = [];
  const cc = (ctx.countryCode || '').toUpperCase();
  const ipCc = (ctx.ipCountry || '').toUpperCase();

  if (cc && blockedCountries.has(cc)) {
    findings.push({
      rule: 'COUNTRY_BLOCKED',
      severity: 'CRITICAL',
      summary: `Account country ${cc} is restricted`,
      evidence: { countryCode: cc },
      blockOperation: true,
    });
  }

  if (ipCc && blockedCountries.has(ipCc)) {
    findings.push({
      rule: 'IP_RISK',
      severity: 'HIGH',
      summary: `Request IP country ${ipCc} is restricted`,
      evidence: { ipCountry: ipCc },
      blockOperation: true,
    });
  }

  if (cc && ipCc && cc !== ipCc) {
    findings.push({
      rule: 'COUNTRY_MISMATCH',
      severity: 'MEDIUM',
      summary: `Profile country ${cc} ≠ IP country ${ipCc}`,
      evidence: { countryCode: cc, ipCountry: ipCc },
      blockOperation: false,
    });
  }

  return findings;
}
