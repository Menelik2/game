/** Verify.ET — https://verify.et/verify (server-side only) */

function firstEnv(...keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function verifyEtConfig() {
  // Accept common name variants users may type in Vercel
  const apiKey = firstEnv(
    'VERIFY_ET_API_KEY',
    'VERIFY_BANK_ET_API_KEY',
    'VERIFY_ET_KEY',
    'VERIFYET_API_KEY',
    'VERIFY_API_KEY',
  );
  const baseUrl = firstEnv('VERIFY_ET_BASE_URL') || 'https://verify.et';
  const webhookSecret = firstEnv('VERIFY_ET_WEBHOOK_SECRET', 'VERIFY_ET_WHSEC');
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
    configured: apiKey.length > 8,
    keyHint: apiKey ? `${apiKey.slice(0, 8)}…(${apiKey.length} chars)` : null,
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
      'Send Telebirr to the number above, then paste the transaction number. We verify it with Verify.ET before crediting your wallet.',
    environment: c.configured ? 'verify.et' : 'manual-review',
    verifier: 'verify.et',
    verifyConfigured: c.configured,
  };
}
