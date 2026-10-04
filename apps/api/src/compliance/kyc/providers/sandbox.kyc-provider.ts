import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import type {
  KycProvider,
  CreateVerificationInput,
  CreateVerificationResult,
  VerificationStatusResult,
  SubmitDocumentsInput,
  WebhookResult,
  KycStatus,
} from '../kyc-provider.interface';

/**
 * Sandbox provider for integration tests ONLY when REAL_MONEY_ENABLED=false.
 * When real money is on, this provider still never auto-APPROVES via API shortcuts —
 * status stays PENDING until a signed webhook with APPROVED is received
 * (webhook secret required). There is no public "approve" endpoint.
 */
@Injectable()
export class SandboxKycProvider implements KycProvider {
  readonly name = 'sandbox';
  private readonly store = new Map<
    string,
    VerificationStatusResult & { userId: string }
  >();

  constructor(private readonly config: ConfigService) {}

  async createVerification(input: CreateVerificationInput): Promise<CreateVerificationResult> {
    const externalId = `sbx_${randomUUID()}`;
    const status: KycStatus = 'PENDING';
    this.store.set(externalId, {
      externalId,
      status,
      level: input.level,
      userId: input.userId,
    });
    return {
      externalId,
      status,
      redirectUrl: undefined,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async getVerificationStatus(externalId: string): Promise<VerificationStatusResult> {
    const row = this.store.get(externalId);
    if (!row) {
      return {
        externalId,
        status: 'NOT_STARTED',
        level: 'BASIC',
      };
    }
    return {
      externalId: row.externalId,
      status: row.status,
      level: row.level,
      rejectionReasons: row.rejectionReasons,
      reviewedAt: row.reviewedAt,
    };
  }

  async submitDocuments(input: SubmitDocumentsInput): Promise<VerificationStatusResult> {
    const row = this.store.get(input.externalId);
    if (!row) {
      return { externalId: input.externalId, status: 'NOT_STARTED', level: 'BASIC' };
    }
    row.status = 'IN_REVIEW';
    this.store.set(input.externalId, row);
    return {
      externalId: row.externalId,
      status: row.status,
      level: row.level,
    };
  }

  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string,
  ): Promise<WebhookResult> {
    const secret = this.config.get<string>('KYC_WEBHOOK_SECRET') || '';
    if (!secret || secret.length < 16) {
      throw new UnauthorizedException({
        code: 'KYC_WEBHOOK_SECRET_MISSING',
        message: 'Webhook secret not configured — rejecting payload',
      });
    }

    const sigHeader = String(headers['x-kyc-signature'] || headers['X-Kyc-Signature'] || '');
    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const a = Buffer.from(sigHeader);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException({
        code: 'KYC_WEBHOOK_INVALID_SIGNATURE',
        message: 'Invalid webhook signature',
      });
    }

    const payload = JSON.parse(body) as {
      externalId: string;
      status: KycStatus;
      userId?: string;
      rejectionReasons?: string[];
    };

    const row = this.store.get(payload.externalId);
    if (row) {
      row.status = payload.status;
      row.rejectionReasons = payload.rejectionReasons;
      row.reviewedAt = new Date();
      this.store.set(payload.externalId, row);
    }

    return {
      externalId: payload.externalId,
      status: payload.status,
      userId: payload.userId || row?.userId,
      rejectionReasons: payload.rejectionReasons,
      processed: true,
    };
  }
}
