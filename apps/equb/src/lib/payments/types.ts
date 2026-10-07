export type PaymentMode = 'demo' | 'real_money';

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
