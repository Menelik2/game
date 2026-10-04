import {
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KycService } from './kyc/kyc.service';
import { AmlService } from './aml/aml.service';
import type { RiskContext, TxEvent } from './aml/aml.types';

/**
 * Single entry point for real-money operations.
 * Order: feature flag → KYC APPROVED → AML evaluate → allow or block.
 * There is no skip path.
 */
@Injectable()
export class RealMoneyGate {
  private readonly logger = new Logger(RealMoneyGate.name);

  constructor(
    private readonly config: ConfigService,
    private readonly kyc: KycService,
    private readonly aml: AmlService,
  ) {}

  isRealMoneyEnabled(): boolean {
    return (
      this.config.get('REAL_MONEY_ENABLED') === true ||
      process.env.REAL_MONEY_ENABLED === 'true'
    );
  }

  /**
   * Call before deposit, withdrawal, or real-money game settlement.
   * Demo mode: returns immediately.
   */
  async assertAllowed(
    userId: string,
    event: Omit<TxEvent, 'userId'> & { userId?: string },
    ctx: Omit<RiskContext, 'userId' | 'kycStatus'> & {
      kycStatus?: string;
      accountAgeHours?: number;
    },
  ): Promise<{ allowed: true } | never> {
    if (!this.isRealMoneyEnabled()) {
      return { allowed: true };
    }

    // 1) KYC — APPROVED only
    await this.kyc.assertKycApprovedForRealMoney(userId);

    const latest = await this.kyc.getLatestForUser(userId);
    const risk: RiskContext = {
      userId,
      kycStatus: latest?.status || 'NOT_STARTED',
      accountAgeHours: ctx.accountAgeHours ?? 0,
      countryCode: ctx.countryCode,
      ipCountry: ctx.ipCountry,
      deviceFingerprint: ctx.deviceFingerprint,
      ip: ctx.ip,
    };

    // 2) Device / IP registration for multi-account detection
    if (ctx.deviceFingerprint) {
      await this.aml.recordDevice({
        userId,
        fingerprintHash: ctx.deviceFingerprint,
        ip: ctx.ip,
        countryCode: ctx.countryCode || ctx.ipCountry,
      });
    }

    // 3) AML rules
    const tx: TxEvent = {
      userId,
      type: event.type,
      amount: event.amount,
      currency: event.currency,
      ip: event.ip || ctx.ip,
      deviceFingerprint: event.deviceFingerprint || ctx.deviceFingerprint,
      countryCode: event.countryCode || ctx.countryCode,
      at: event.at || new Date(),
    };

    const { findings, blocked, alertIds } = await this.aml.evaluateTransaction(
      tx,
      risk,
    );

    if (blocked) {
      this.logger.warn(
        `AML block user=${userId} alerts=${alertIds.join(',')} rules=${findings
          .filter((f) => f.blockOperation)
          .map((f) => f.rule)
          .join(',')}`,
      );
      throw new ForbiddenException({
        code: 'AML_HOLD',
        message:
          'Transaction held for compliance review. Contact support if this persists.',
        alertIds,
        rules: findings.filter((f) => f.blockOperation).map((f) => f.rule),
      });
    }

    return { allowed: true };
  }
}
