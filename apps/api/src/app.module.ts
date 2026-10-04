import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './common/health.controller';
import { EqubModule } from './equb/equb.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { AuditModule } from './audit/audit.module';
import configuration from './config/configuration';

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

/**
 * Fast Equb API
 * - Equb rooms always available (in-memory)
 * - Auth + Admin + wallets when DATABASE_URL is set
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: (config.get<number>('RATE_LIMIT_TTL', 60) || 60) * 1000,
          limit: config.get<number>('RATE_LIMIT_LIMIT', 200) || 200,
        },
      ],
    }),
    // Postgres — required for auth, admin, wallets
    ...(hasDatabase
      ? [
          TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              type: 'postgres' as const,
              url: config.get<string>('DATABASE_URL') || process.env.DATABASE_URL,
              ssl:
                config.get('DATABASE_SSL') === true ||
                process.env.DATABASE_SSL === 'true'
                  ? { rejectUnauthorized: false }
                  : false,
              autoLoadEntities: true,
              synchronize:
                process.env.SYNC_DB === 'true' ||
                process.env.NODE_ENV !== 'production',
              logging: process.env.TYPEORM_LOGGING === 'true',
            }),
          }),
          AuthModule,
          AdminModule,
          UsersModule,
          WalletModule,
          AuditModule,
        ]
      : []),
    EqubModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
