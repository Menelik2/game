import {
  Injectable,
  Inject,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KycVerification } from '../entities/kyc-verification.entity';
import {
  KYC_PROVIDER,
  type KycProvider,
  type KycLevel,
  type KycStatus,
} from './kyc-provider.interface';

/**
 * KYC orchestration — persists verification state and gates real-money actions.
 * No bypass: when REAL_MONEY_ENABLED, only status === APPROVED unlocks payouts.
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(
    @Inject(KYC_PROVIDER) private readonly provider: KycProvider,
    @InjectRepository(KycVerification)
    private readonly kycRepo: Repository<KycVerification>,
    private readonly config: ConfigService,
  ) {}

  isRealMoneyEnabled(): boolean {
    return (
      this.config.get('REAL_MONEY_ENABLED') === true ||
      process.env.REAL_MONEY_ENABLED === 'true'
    );
  }

  async getLatestForUser(userId: string): Promise<KycVerification | null> {
    return this.kycRepo.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async createVerification(input: {
    userId: string;
    level?: KycLevel;
    countryCode: string;
    email?: string;
    phone?: string;
  }) {
    const result = await this.provider.createVerification({
      userId: input.userId,
      level: input.level || 'STANDARD',
      countryCode: input.countryCode,
      email: input.email,
      phone: input.phone,
    });

    const row = await this.kycRepo.save(
      this.kycRepo.create({
        userId: input.userId,
        externalId: result.externalId,
        provider: this.provider.name,
        level: input.level || 'STANDARD',
        status: result.status,
        countryCode: input.countryCode,
        metadata: { redirectUrl: result.redirectUrl },
      }),
    );

    return {
      id: row.id,
      externalId: row.externalId,
      status: row.status,
      provider: row.provider,
      redirectUrl: result.redirectUrl,
      expiresAt: result.expiresAt,
    };
  }

  async refreshStatus(externalId: string) {
    const row = await this.kycRepo.findOne({ where: { externalId } });
    if (!row) throw new NotFoundException({ message: 'Verification not found' });

    const remote = await this.provider.getVerificationStatus(externalId);
    row.status = remote.status;
    row.rejectionReasons = remote.rejectionReasons || null;
    row.reviewedAt = remote.reviewedAt || null;
    await this.kycRepo.save(row);
    return row;
  }

  async submitDocuments(
    externalId: string,
    documents: Array<{ type: string; contentRef: string; mimeType: string }>,
  ) {
    const row = await this.kycRepo.findOne({ where: { externalId } });
    if (!row) throw new NotFoundException({ message: 'Verification not found' });

    const remote = await this.provider.submitDocuments({
      externalId,
      documents: documents as any,
    });
    row.status = remote.status;
    await this.kycRepo.save(row);
    return row;
  }

  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer | string,
  ) {
    const result = await this.provider.handleWebhook(headers, rawBody);
    if (!result.processed) return result;

    const row = await this.kycRepo.findOne({
      where: { externalId: result.externalId },
    });
    if (row) {
      row.status = result.status;
      row.rejectionReasons = result.rejectionReasons || null;
      row.reviewedAt = new Date();
      await this.kycRepo.save(row);
      this.logger.log(`KYC webhook ${result.externalId} → ${result.status}`);
    }
    return result;
  }

  /**
   * Gate for deposits / withdrawals / real-money games.
   * Throws if real-money is on and user is not KYC APPROVED.
   */
  async assertKycApprovedForRealMoney(userId: string): Promise<void> {
    if (!this.isRealMoneyEnabled()) return;

    const latest = await this.getLatestForUser(userId);
    const status = (latest?.status || 'NOT_STARTED') as KycStatus;

    if (status !== 'APPROVED') {
      throw new ForbiddenException({
        code: 'KYC_REQUIRED',
        message: 'Complete identity verification before real-money activity',
        kycStatus: status,
      });
    }
  }
}
