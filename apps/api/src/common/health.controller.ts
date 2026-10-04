import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { pingDatabase } from '../database/db-ping';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get('health')
  async check() {
    const db = await pingDatabase();
    return {
      status: db.configured && !db.connected ? 'degraded' : 'ok',
      service: 'fast-equb-api',
      timestamp: new Date().toISOString(),
      demoMode: this.config.get('DEMO_MODE') !== false,
      realMoneyEnabled: this.config.get('REAL_MONEY_ENABLED') === true,
      equb: true,
      database: {
        configured: db.configured,
        connected: db.connected,
        ...(db.error ? { error: db.error } : {}),
      },
    };
  }

  @Get()
  async root() {
    return this.check();
  }
}
