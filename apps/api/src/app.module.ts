import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './common/health.controller';
import { EqubModule } from './equb/equb.module';
import configuration from './config/configuration';

/**
 * Fast Equb API — multiplayer rooms in-memory.
 * No Postgres required for Equb rooms / join / draw.
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
