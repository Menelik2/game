/** Public merchant display. Secrets stay in env and are never returned. */
export type TelebirrPublicConfig = {
  enabled: boolean;
  environment: 'sandbox' | 'production';
  merchantName: string;
  merchantPhone: string;
  currency: 'ETB';
  minDeposit: number;
  maxDeposit: number;
  checkoutAvailable: boolean;
  instruction: string;
};

export function telebirrPublicConfig(): TelebirrPublicConfig {
  const env = process.env.TELEBIRR_ENV === 'production' ? 'production' : 'sandbox';
  const phone = process.env.TELEBIRR_MERCHANT_PHONE || '0977832379';
  const name = process.env.TELEBIRR_MERCHANT_NAME || 'Menelik';
  const checkoutAvailable = Boolean(
    process.env.TELEBIRR_BASE_URL &&
      process.env.TELEBIRR_FABRIC_APP_ID &&
      process.env.TELEBIRR_APP_SECRET,
  );
  return {
    enabled: process.env.TELEBIRR_ENABLED !== 'false',
    environment: env,
    merchantName: name,
    merchantPhone: phone,
    currency: 'ETB',
    minDeposit: Number(process.env.TELEBIRR_MIN_DEPOSIT || 10),
    maxDeposit: Number(process.env.TELEBIRR_MAX_DEPOSIT || 50000),
    checkoutAvailable,
    instruction: 'Complete your Telebirr payment and verify the transaction.',
  };
}

export function hasSigningSecrets(): boolean {
  return Boolean(process.env.TELEBIRR_APP_SECRET && process.env.TELEBIRR_WEBHOOK_SECRET);
}
