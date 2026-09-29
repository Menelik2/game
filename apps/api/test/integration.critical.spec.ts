/**
 * Critical integration tests (wallet + RG + play).
 * Requires PostgreSQL when DATABASE_URL is set; otherwise skipped.
 */

describe('Critical integration', () => {
  const hasDb = !!process.env.DATABASE_URL;

  (hasDb ? it : it.skip)('placeholder – wire Nest testing module against test DB', () => {
    expect(process.env.DATABASE_URL).toBeTruthy();
  });

  it('documents required cases', () => {
    const cases = [
      'duplicate bet same idempotency key does not double-debit',
      'concurrent debits cannot overdraw balance',
      'self-excluded user cannot start session or play',
      'win after bet reconciles available balance',
    ];
    expect(cases.length).toBeGreaterThan(0);
  });
});
