/**
 * Verify.ET config — https://verify.et/docs/api
 * Server-side only. Never expose apiKey to the client.
 */

function firstEnv(...keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function verifyEtConfig() {
  // Keys look like VERIFY_BANK_ET_…
  const apiKey = firstEnv(
    'VERIFY_ET_API_KEY',
    'VERIFY_BANK_ET_API_KEY',
    'VERIFY_ET_KEY',
    'VERIFYET_API_KEY',
  );
  const baseUrl = firstEnv('VERIFY_ET_BASE_URL') || 'https://verify.et';
  // Dashboard webhook secret (whsec_…)
  const webhookSecret = firstEnv(
    'VERIFY_ET_WEBHOOK_SECRET',
    'VERIFY_ET_WHSEC',
  );
  const settlementAccount =
    firstEnv('TELEBIRR_MERCHANT_PHONE', 'WALLET_MERCHANT_PHONE') || '0977832379';
  const merchantName =
    firstEnv('TELEBIRR_MERCHANT_NAME', 'WALLET_MERCHANT_NAME') || 'Menelik';

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/$/, ''),
    webhookSecret,
    settlementAccount,
    merchantName,
    // Official keys are long; require meaningful length
    configured: apiKey.length >= 16,
    keyHint: apiKey ? `${apiKey.slice(0, 12)}…(${apiKey.length} chars)` : null,
    minDeposit: Number(process.env.WALLET_MIN_DEPOSIT || 10),
    maxDeposit: Number(process.env.WALLET_MAX_DEPOSIT || 50000),
  };
}

export function publicWalletConfig() {
  const c = verifyEtConfig();
  return {
    merchantName: c.merchantName,
    merchantPhone: c.settlementAccount,
    checkoutAvailable: false,
    instruction:
      'Send Telebirr to the number above, then paste the transaction number. We verify it with Verify.ET (https://verify.et/docs/api) before crediting your wallet.',
    environment: c.configured ? 'verify.et' : 'manual-review',
    verifier: 'verify.et',
    verifyConfigured: c.configured,
    docsUrl: 'https://verify.et/docs/api',
  };
}
