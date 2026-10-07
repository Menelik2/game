export type PaymentMode = 'demo' | 'real_money';

/** Active checkout / deposit channel */
export type PaymentProviderName = 'none' | 'chapa' | 'stripe' | 'telebirr';

export type DepositStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'CONFIRMED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REVERSED'
  | 'REVIEW_REQUIRED';

export type PaymentDirection = 'deposit' | 'withdraw';

/**
 * In-memory / provider payment transaction record.
 * Must stay exported — used by store.ts and payment API routes.
 */
export type PaymentTransaction = {
  id: string;
  userId: string;
  provider: PaymentProviderName;
  providerRef: string;
  amount: number;
  currency: string;
  status: DepositStatus;
  direction: PaymentDirection;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};
