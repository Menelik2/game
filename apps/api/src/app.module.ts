import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GamesModule } from './games/games.module';
import { WalletModule } from './wallet/wallet.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AdminModule } from './admin/admin.module';
import { ResponsibleGamingModule } from './responsible-gaming/responsible-gaming.module';
import { AuditModule } from './audit/audit.module';
import { BonusesModule } from './bonuses/bonuses.module';
import { RealtimeModule } from './realtime/realtime.module';
import { HealthController } from './common/health.controller';
import { EqubModule } from './equb/equb.module';
import { KenoRoundsModule } from './keno-rounds/keno-rounds.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const sync =
          config.get<string>('SYNC_DB') === 'true' ||
          process.env.SYNC_DB === 'true';
        const sslOn =
          config.get('DATABASE_SSL') === true ||
          process.env.DATABASE_SSL === 'true';
        return {
          type: 'postgres' as const,
          url: config.get<string>('DATABASE_URL'),
          autoLoadEntities: true,
          // Demo / first Render deploy: set SYNC_DB=true to create tables without migrations
          synchronize: sync,
          logging: config.get('NODE_ENV') === 'development',
          ssl: sslOn ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('RATE_LIMIT_TTL', 60) * 1000,
          limit: config.get<number>('RATE_LIMIT_LIMIT', 100),
        },
      ],
    }),
    AuthModule,
    UsersModule,
    GamesModule,
    WalletModule,
    TransactionsModule,
    AdminModule,
    ResponsibleGamingModule,
    AuditModule,
    BonusesModule,
    RealtimeModule,
    EqubModule,
    KenoRoundsModule,
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
