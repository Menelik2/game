import type { AmlFinding, TxEvent } from '../aml.types';

/** Rolling-window velocity limits (configurable via env later) */
const LIMITS = {
  depositCount1h: 5,
  depositSum1h: 50_000,
  withdrawCount1h: 3,
  withdrawSum1h: 30_000,
  depositCount24h: 20,
  withdrawCount24h: 10,
};

export function evaluateVelocity(
  event: TxEvent,
  recent: TxEvent[],
): AmlFinding[] {
  const findings: AmlFinding[] = [];
  const now = event.at?.getTime() || Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const sameType = (t: TxEvent['type']) =>
    recent.filter((r) => r.type === t && (r.at?.getTime() || 0) >= hourAgo);

  if (event.type === 'DEPOSIT') {
    const h = sameType('DEPOSIT');
    const count1h = h.length + 1;
    const sum1h = h.reduce((s, r) => s + r.amount, 0) + event.amount;
    if (count1h > LIMITS.depositCount1h || sum1h > LIMITS.depositSum1h) {
      findings.push({
        rule: 'VELOCITY_DEPOSIT',
        severity: sum1h > LIMITS.depositSum1h * 2 ? 'CRITICAL' : 'HIGH',
        summary: `Deposit velocity exceeded (${count1h} txs / ${sum1h} in 1h)`,
        evidence: { count1h, sum1h, limits: LIMITS },
        blockOperation: true,
      });
    }
    const dayCount =
      recent.filter((r) => r.type === 'DEPOSIT' && (r.at?.getTime() || 0) >= dayAgo)
        .length + 1;
    if (dayCount > LIMITS.depositCount24h) {
      findings.push({
        rule: 'VELOCITY_DEPOSIT',
        severity: 'MEDIUM',
        summary: `Deposit count 24h exceeded (${dayCount})`,
        evidence: { dayCount },
        blockOperation: false,
      });
    }
  }

  if (event.type === 'WITHDRAWAL') {
    const h = sameType('WITHDRAWAL');
    const count1h = h.length + 1;
    const sum1h = h.reduce((s, r) => s + r.amount, 0) + event.amount;
    if (count1h > LIMITS.withdrawCount1h || sum1h > LIMITS.withdrawSum1h) {
      findings.push({
        rule: 'VELOCITY_WITHDRAWAL',
        severity: 'HIGH',
        summary: `Withdrawal velocity exceeded (${count1h} txs / ${sum1h} in 1h)`,
        evidence: { count1h, sum1h, limits: LIMITS },
        blockOperation: true,
      });
    }
  }

  return findings;
}
