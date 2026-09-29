import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallet.service';

@ApiTags('Wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get current wallet balances (DEMO currency)' })
  async getWallet(@Req() req: { user: { id: string } }) {
    const wallet = await this.walletService.getWallet(req.user.id);
    return {
      id: wallet.id,
      currency: wallet.currency,
      availableBalance: parseFloat(wallet.availableBalance),
      lockedBalance: parseFloat(wallet.lockedBalance),
      bonusBalance: parseFloat(wallet.bonusBalance),
      status: wallet.status,
      demoMode: true,
      note: 'Virtual credits only – no real money',
    };
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List wallet transactions' })
  async getTransactions(
    @Req() req: { user: { id: string } },
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.walletService.getTransactions(req.user.id, Number(page), Number(limit));
  }
}
