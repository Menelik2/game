import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BonusesService } from './bonuses.service';

@ApiTags('Bonuses')
@Controller('bonuses')
export class BonusesController {
  constructor(private readonly bonuses: BonusesService) {}

  @Get()
  list() {
    return this.bonuses.listActive();
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  mine(@Req() req: { user: { id: string } }) {
    return this.bonuses.myBonuses(req.user.id);
  }

  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  claim(@Req() req: { user: { id: string } }, @Param('id') id: string) {
    return this.bonuses.claim(req.user.id, id);
  }
}
