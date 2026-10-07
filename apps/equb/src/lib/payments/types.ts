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
 * Provider payment transaction (Chapa / Telebirr / etc).
 * Imported by store.ts and API routes.
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

// Explicit named re-exports for tooling that only sees export lists
export type {
  PaymentMode as EqubPaymentMode,
  PaymentProviderName as EqubPaymentProvider,
  DepositStatus as EqubDepositStatus,
  PaymentTransaction as EqubPaymentTransaction,
};
