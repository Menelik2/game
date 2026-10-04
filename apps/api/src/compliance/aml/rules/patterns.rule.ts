import type { AmlFinding, TxEvent } from '../aml.types';

/** Unusual deposit/withdrawal patterns + structuring heuristics */
export function evaluatePatterns(
  event: TxEvent,
  recent: TxEvent[],
): AmlFinding[] {
  const findings: AmlFinding[] = [];
  const dayAgo = (event.at?.getTime() || Date.now()) - 24 * 60 * 60 * 1000;
  const day = recent.filter((r) => (r.at?.getTime() || 0) >= dayAgo);

  // Round-trip: large deposit followed by withdrawal within 30 min
  if (event.type === 'WITHDRAWAL') {
    const window = (event.at?.getTime() || Date.now()) - 30 * 60 * 1000;
    const priorDeposit = recent.find(
      (r) =>
        r.type === 'DEPOSIT' &&
        (r.at?.getTime() || 0) >= window &&
        r.amount >= event.amount * 0.8,
    );
    if (priorDeposit) {
      findings.push({
        rule: 'RAPID_ROUND_TRIP',
        severity: 'HIGH',
        summary: 'Withdrawal shortly after similar-sized deposit',
        evidence: {
          depositAmount: priorDeposit.amount,
          withdrawAmount: event.amount,
        },
        blockOperation: true,
      });
    }
  }

  // Structuring: many txs just under a threshold (e.g. 10_000)
  const threshold = 10_000;
  const near = day.filter(
    (r) => r.amount >= threshold * 0.85 && r.amount < threshold,
  );
  if (near.length >= 3 && event.amount >= threshold * 0.85 && event.amount < threshold) {
    findings.push({
      rule: 'STRUCTURING',
      severity: 'HIGH',
      summary: 'Multiple transactions just under reporting threshold',
      evidence: { count: near.length + 1, threshold },
      blockOperation: true,
    });
  }

  // Unusual single amount vs user history median
  const amounts = day.map((r) => r.amount).sort((a, b) => a - b);
  if (amounts.length >= 5) {
    const median = amounts[Math.floor(amounts.length / 2)]!;
    if (event.amount > median * 10 && event.amount > 5_000) {
      findings.push({
        rule: 'UNUSUAL_AMOUNT',
        severity: 'MEDIUM',
        summary: `Amount ${event.amount} far above recent median ${median}`,
        evidence: { amount: event.amount, median },
        blockOperation: false,
      });
    }
  }

  return findings;
}
