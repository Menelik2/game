import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KycVerification } from './entities/kyc-verification.entity';
import { AmlAlert } from './entities/aml-alert.entity';
import { DeviceFingerprint } from './entities/device-fingerprint.entity';
import { KycService } from './kyc/kyc.service';
import { KycController } from './kyc/kyc.controller';
import { AmlService } from './aml/aml.service';
import { ManualReviewController } from './review/manual-review.controller';
import { RealMoneyGate } from './real-money.gate';
import { KYC_PROVIDER } from './kyc/kyc-provider.interface';
import { NullKycProvider } from './kyc/providers/null.kyc-provider';
import { SandboxKycProvider } from './kyc/providers/sandbox.kyc-provider';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([KycVerification, AmlAlert, DeviceFingerprint]),
  ],
  controllers: [KycController, ManualReviewController],
  providers: [
    KycService,
    AmlService,
    RealMoneyGate,
    NullKycProvider,
    SandboxKycProvider,
    {
      provide: KYC_PROVIDER,
      inject: [ConfigService, NullKycProvider, SandboxKycProvider],
      useFactory: (
        config: ConfigService,
        nullProvider: NullKycProvider,
        sandbox: SandboxKycProvider,
      ) => {
        const name = (
          config.get<string>('KYC_PROVIDER') ||
          process.env.KYC_PROVIDER ||
          'null'
        ).toLowerCase();
        // Production real-money: set KYC_PROVIDER to a real vendor implementation.
        // Never map "skip" or "auto_approve" here.
        if (name === 'sandbox') return sandbox;
        return nullProvider;
      },
    },
  ],
  exports: [KycService, AmlService, RealMoneyGate],
})
export class ComplianceModule {}
