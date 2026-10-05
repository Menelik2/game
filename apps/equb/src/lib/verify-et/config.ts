/** Verify.ET — https://verify.et/verify (server-side only) */

export function verifyEtConfig() {
  const apiKey = process.env.VERIFY_ET_API_KEY || process.env.VERIFY_BANK_ET_API_KEY || '';
  const baseUrl = (process.env.VERIFY_ET_BASE_URL || 'https://verify.et').replace(/\/$/, '');
  const webhookSecret = process.env.VERIFY_ET_WEBHOOK_SECRET || '';
  const settlementAccount =
    process.env.TELEBIRR_MERCHANT_PHONE ||
    process.env.WALLET_MERCHANT_PHONE ||
    '0977832379';
  const merchantName =
    process.env.TELEBIRR_MERCHANT_NAME ||
    process.env.WALLET_MERCHANT_NAME ||
    'Menelik';
  return {
    apiKey,
    baseUrl,
    webhookSecret,
    settlementAccount,
    merchantName,
    configured: Boolean(apiKey),
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
  };
}
