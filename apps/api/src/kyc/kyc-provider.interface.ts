/**
 * KYC provider adapter.
 * Never claim verification succeeded without provider confirmation.
 */
export interface KycProvider {
  readonly name: string;
  startVerification(userId: string, data: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    country: string;
  }): Promise<{ sessionId: string; redirectUrl?: string }>;
  getStatus(sessionId: string): Promise<'PENDING' | 'APPROVED' | 'REJECTED'>;
}
