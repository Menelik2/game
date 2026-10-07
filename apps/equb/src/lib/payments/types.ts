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
