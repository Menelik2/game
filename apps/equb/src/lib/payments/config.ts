import type { PaymentMode, PaymentProviderName } from './types';

export function getPaymentMode(): PaymentMode {
  const enabled =
    process.env.REAL_MONEY_ENABLED === 'true' ||
    process.env.NEXT_PUBLIC_REAL_MONEY_ENABLED === 'true';
  return enabled ? 'real_money' : 'demo';
}

export function getActiveProvider(): PaymentProviderName {
  if (getPaymentMode() !== 'real_money') return 'none';
  const p = (process.env.PAYMENT_PROVIDER || '').toLowerCase();
  if (p === 'chapa' && process.env.CHAPA_SECRET_KEY) return 'chapa';
  if (p === 'stripe' && process.env.STRIPE_SECRET_KEY) return 'stripe';
  return 'none';
}

export function isRealMoneyLive(): boolean {
  return getPaymentMode() === 'real_money' && getActiveProvider() !== 'none';
}

export function paymentPublicConfig() {
  return {
    mode: getPaymentMode(),
    provider: getActiveProvider(),
    realMoneyLive: isRealMoneyLive(),
    currency: process.env.PAYMENT_CURRENCY || 'ETB',
    minDeposit: Number(process.env.PAYMENT_MIN_DEPOSIT || 10),
    maxDeposit: Number(process.env.PAYMENT_MAX_DEPOSIT || 50000),
    note:
      getPaymentMode() === 'demo'
        ? 'Demo / social mode — virtual Birr only. No real-money deposits.'
        : isRealMoneyLive()
          ? 'Real-money mode — payments via licensed provider.'
          : 'Real-money flag on but provider keys missing.',
  };
}
