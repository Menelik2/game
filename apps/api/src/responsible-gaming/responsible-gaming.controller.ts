import { Controller, Get, Patch, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResponsibleGamingService } from './responsible-gaming.service';

@ApiTags('Responsible Gaming')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('responsible-gaming')
export class ResponsibleGamingController {
  constructor(private readonly rg: ResponsibleGamingService) {}

  @Get('limits')
  getLimits(@Req() req: { user: { id: string } }) {
    return this.rg.getLimits(req.user.id);
  }

  @Patch('limits')
  setLimits(
    @Req() req: { user: { id: string } },
    @Body()
    body: {
      dailyDepositLimit?: number | null;
      weeklyDepositLimit?: number | null;
      monthlyDepositLimit?: number | null;
      dailyLossLimit?: number | null;
      sessionLimitMinutes?: number | null;
    },
  ) {
    return this.rg.setLimits(req.user.id, body);
  }

  @Post('self-exclusion')
  selfExclude(
    @Req() req: { user: { id: string } },
    @Body() body: { durationDays: number; reason?: string },
  ) {
    return this.rg.selfExclude(req.user.id, body.durationDays, body.reason);
  }

  @Get('self-exclusion')
  getExclusion(@Req() req: { user: { id: string } }) {
    return this.rg.getActiveExclusion(req.user.id);
  }
}
