import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get('health')
  check() {
    return {
      status: 'ok',
      service: 'fast-equb-api',
      timestamp: new Date().toISOString(),
      demoMode: this.config.get('DEMO_MODE') !== false,
      realMoneyEnabled: this.config.get('REAL_MONEY_ENABLED') === true,
      database: Boolean(process.env.DATABASE_URL?.trim()),
      equb: true,
    };
  }

  @Get()
  root() {
    return this.check();
  }
}
