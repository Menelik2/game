import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { KenoRoundsService } from './keno-rounds.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Keno Rounds')
@Controller('keno/rounds')
export class KenoRoundsController {
  constructor(private readonly rounds: KenoRoundsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Current open Keno round' })
  current() {
    return this.rounds.getCurrent();
  }

  @Get('history')
  @ApiOperation({ summary: 'Recent settled rounds' })
  history() {
    return this.rounds.getHistory(15);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get round by id' })
  one(@Param('id') id: string) {
    return this.rounds.getOne(id);
  }

  @Post('bet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Place bet on current open round' })
  bet(
    @Req() req: { user: { id: string; displayName?: string } },
    @Body() body: { picks: number[]; betAmount: number },
  ) {
    return this.rounds.placeBet({
      userId: req.user.id,
      playerName: req.user.displayName,
      picks: body.picks,
      betAmount: body.betAmount,
    });
  }
}
