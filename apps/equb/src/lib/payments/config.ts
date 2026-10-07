import type { PaymentMode, PaymentProviderName } from './types';

export function getPaymentMode(): PaymentMode {
  const enabled =
    process.env.REAL_MONEY_ENABLED === 'true' ||
    process.env.NEXT_PUBLIC_REAL_MONEY_ENABLED === 'true' ||
    // Production default: real money when demo flag is not on
    (process.env.NODE_ENV === 'production' &&
      process.env.DEMO_MODE !== 'true' &&
      process.env.NEXT_PUBLIC_DEMO_MODE !== 'true');
  return enabled ? 'real_money' : 'demo';
}

function telebirrConfigured(): boolean {
  const phone =
    process.env.TELEBIRR_MERCHANT_PHONE ||
    process.env.WALLET_MERCHANT_PHONE ||
    '';
  const verifyKey =
    process.env.VERIFY_ET_API_KEY ||
    process.env.VERIFY_BANK_ET_API_KEY ||
    process.env.VERIFY_ET_KEY ||
    '';
  // Merchant phone alone enables manual Telebirr + admin/verify flow
  return phone.replace(/\D/g, '').length >= 9 || verifyKey.length > 8;
}

export function getActiveProvider(): PaymentProviderName {
  if (getPaymentMode() !== 'real_money') return 'none';
  const p = (process.env.PAYMENT_PROVIDER || 'telebirr').toLowerCase();
  if (p === 'chapa' && process.env.CHAPA_SECRET_KEY) return 'chapa';
  if (p === 'stripe' && process.env.STRIPE_SECRET_KEY) return 'stripe';
  if ((p === 'telebirr' || p === 'verify.et' || p === 'verify_et' || !p) && telebirrConfigured()) {
    return 'telebirr' as PaymentProviderName;
  }
  if (telebirrConfigured()) return 'telebirr' as PaymentProviderName;
  return 'none';
}

export function isRealMoneyLive(): boolean {
  return getPaymentMode() === 'real_money' && getActiveProvider() !== 'none';
}

export function paymentPublicConfig() {
  const mode = getPaymentMode();
  const provider = getActiveProvider();
  const live = mode === 'real_money' && provider !== 'none';
  return {
    mode,
    provider,
    realMoneyLive: live,
    currency: process.env.PAYMENT_CURRENCY || 'ETB',
    minDeposit: Number(process.env.PAYMENT_MIN_DEPOSIT || process.env.WALLET_MIN_DEPOSIT || 10),
    maxDeposit: Number(process.env.PAYMENT_MAX_DEPOSIT || process.env.WALLET_MAX_DEPOSIT || 50000),
    note:
      mode === 'demo'
        ? 'Demo mode — virtual Birr only.'
        : live
          ? provider === 'telebirr'
            ? 'Real money · Telebirr deposits verified before wallet credit.'
            : `Real money · ${provider} payments.`
          : 'Real-money flag on but no payment provider configured (set TELEBIRR_MERCHANT_PHONE or VERIFY_ET_API_KEY).',
  };
}
