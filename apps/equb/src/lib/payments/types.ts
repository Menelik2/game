export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export type PaymentMode = 'demo' | 'real_money';

export type PaymentProviderName = 'none' | 'chapa' | 'stripe';

export type PaymentTransaction = {
  id: string;
  userId: string;
  provider: PaymentProviderName;
  providerRef: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  direction: 'deposit' | 'withdrawal';
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};
