/**
 * Payment provider adapter interface.
 * Real-money mode must only be enabled after licensing.
 * DEMO mode never invokes these methods for real funds.
 */
export interface PaymentProvider {
  readonly name: string;
  createDeposit(params: {
    userId: string;
    amount: number;
    currency: string;
    returnUrl: string;
  }): Promise<{ providerRef: string; redirectUrl?: string }>;
  createWithdrawal(params: {
    userId: string;
    amount: number;
    currency: string;
  }): Promise<{ providerRef: string; status: string }>;
  handleWebhook(payload: unknown, signature: string): Promise<{
    status: 'COMPLETED' | 'FAILED' | 'PENDING';
    providerRef: string;
    amount?: number;
  }>;
}
