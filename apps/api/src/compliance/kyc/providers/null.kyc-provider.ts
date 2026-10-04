import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  KycProvider,
  CreateVerificationInput,
  CreateVerificationResult,
  VerificationStatusResult,
  SubmitDocumentsInput,
  WebhookResult,
} from '../kyc-provider.interface';

/**
 * Null / unconfigured provider.
 * When REAL_MONEY_ENABLED and no real KYC vendor is configured,
 * all operations fail closed — never auto-approve.
 */
@Injectable()
export class NullKycProvider implements KycProvider {
  readonly name = 'null';

  private fail(): never {
    throw new ServiceUnavailableException({
      code: 'KYC_PROVIDER_NOT_CONFIGURED',
      message:
        'Real-money mode requires a configured KYC provider (set KYC_PROVIDER + credentials).',
    });
  }

  async createVerification(_input: CreateVerificationInput): Promise<CreateVerificationResult> {
    this.fail();
  }

  async getVerificationStatus(_externalId: string): Promise<VerificationStatusResult> {
    this.fail();
  }

  async submitDocuments(_input: SubmitDocumentsInput): Promise<VerificationStatusResult> {
    this.fail();
  }

  async handleWebhook(
    _headers: Record<string, string | string[] | undefined>,
    _rawBody: Buffer | string,
  ): Promise<WebhookResult> {
    this.fail();
  }
}
