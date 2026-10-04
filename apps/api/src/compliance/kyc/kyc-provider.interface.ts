/**
 * KYC Provider Interface
 *
 * All real-money identity checks go through this abstraction.
 * Swap implementations (Sumsub, Onfido, Jumio, local) via KYC_PROVIDER env.
 *
 * HARD RULES
 * ──────────
 * - No method may auto-approve when REAL_MONEY_ENABLED without a real provider result.
 * - Webhooks must verify signatures before updating status.
 * - There is no "skip KYC" / "demo approve" path for real-money users.
 */

export type KycLevel = 'BASIC' | 'STANDARD' | 'ENHANCED';

export type KycStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REQUIRES_RETRY';

export type DocumentType =
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'DRIVERS_LICENSE'
  | 'SELFIE'
  | 'PROOF_OF_ADDRESS'
  | 'OTHER';

export interface CreateVerificationInput {
  userId: string;
  level: KycLevel;
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  email?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateVerificationResult {
  externalId: string;
  status: KycStatus;
  /** Hosted verification URL if provider supports it */
  redirectUrl?: string;
  expiresAt?: Date;
}

export interface VerificationStatusResult {
  externalId: string;
  status: KycStatus;
  level: KycLevel;
  rejectionReasons?: string[];
  reviewedAt?: Date;
  raw?: Record<string, unknown>;
}

export interface SubmitDocumentsInput {
  externalId: string;
  documents: Array<{
    type: DocumentType;
    /** Base64 or pre-signed upload reference — never log full content */
    contentRef: string;
    mimeType: string;
  }>;
}

export interface WebhookResult {
  externalId: string;
  status: KycStatus;
  userId?: string;
  rejectionReasons?: string[];
  processed: boolean;
}

export interface KycProvider {
  readonly name: string;

  createVerification(input: CreateVerificationInput): Promise<CreateVerificationResult>;

  getVerificationStatus(externalId: string): Promise<VerificationStatusResult>;

  submitDocuments(input: SubmitDocumentsInput): Promise<VerificationStatusResult>;

  /**
   * Parse + verify provider webhook.
   * MUST reject unsigned / invalid payloads (throw).
   */
  handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string,
  ): Promise<WebhookResult>;
}

export const KYC_PROVIDER = Symbol('KYC_PROVIDER');
