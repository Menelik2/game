import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../admin/guards/admin.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { AmlService } from '../aml/aml.service';

/**
 * Manual review workflow for compliance analysts.
 * CONFIRM / DISMISS only — never auto-clears KYC or skips AML re-check on new txs.
 */
@ApiTags('Compliance Review')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard, RolesGuard)
@Controller('compliance/reviews')
export class ManualReviewController {
  constructor(private readonly aml: AmlService) {}

  @Get('alerts')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Open AML alerts queue' })
  list(@Query('page') page = 1) {
    return this.aml.listOpenAlerts(Number(page) || 1, 40);
  }

  @Post('alerts/:id/claim')
  @RequirePermissions('audit:read')
  claim(@Param('id') id: string, @Req() req: { user: { userId: string } }) {
    return this.aml.assignReview(id, req.user.userId);
  }

  @Post('alerts/:id/resolve')
  @RequirePermissions('users:update')
  resolve(
    @Param('id') id: string,
    @Req() req: { user: { userId: string } },
    @Body() body: { decision: 'CONFIRMED' | 'DISMISSED'; notes: string },
  ) {
    return this.aml.resolveAlert(
      id,
      req.user.userId,
      body.decision,
      body.notes || '',
    );
  }
}
