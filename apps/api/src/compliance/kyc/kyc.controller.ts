import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Headers,
  UseGuards,
  RawBodyRequest,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { KycService } from './kyc.service';

@ApiTags('KYC')
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Current user KYC status' })
  async me(@Req() req: { user: { userId: string } }) {
    const row = await this.kyc.getLatestForUser(req.user.userId);
    return {
      realMoneyEnabled: this.kyc.isRealMoneyEnabled(),
      status: row?.status || 'NOT_STARTED',
      level: row?.level || null,
      provider: row?.provider || null,
      rejectionReasons: row?.rejectionReasons || null,
      reviewedAt: row?.reviewedAt || null,
    };
  }

  @Post('verifications')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() req: { user: { userId: string } },
    @Body()
    body: {
      countryCode: string;
      level?: 'BASIC' | 'STANDARD' | 'ENHANCED';
      email?: string;
      phone?: string;
    },
  ) {
    return this.kyc.createVerification({
      userId: req.user.userId,
      countryCode: body.countryCode,
      level: body.level,
      email: body.email,
      phone: body.phone,
    });
  }

  @Get('verifications/:externalId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async status(@Param('externalId') externalId: string) {
    return this.kyc.refreshStatus(externalId);
  }

  @Post('verifications/:externalId/documents')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async documents(
    @Param('externalId') externalId: string,
    @Body()
    body: {
      documents: Array<{ type: string; contentRef: string; mimeType: string }>;
    },
  ) {
    return this.kyc.submitDocuments(externalId, body.documents || []);
  }

  /**
   * Provider webhook — signature verified inside provider.
   * No auth bearer; authenticity = HMAC only.
   */
  @Post('webhooks')
  @ApiOperation({ summary: 'KYC provider webhook (signed)' })
  async webhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const raw = req.rawBody || (req.body as Buffer) || Buffer.from('');
    return this.kyc.handleWebhook(headers, raw);
  }
}
