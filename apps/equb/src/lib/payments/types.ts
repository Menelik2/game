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

/** In-memory / provider payment transaction record */
export interface PaymentTransaction {
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
}

export type { PaymentTransaction as PaymentTx };
