import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Games')
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  @ApiOperation({ summary: 'List / search / filter games' })
  async list(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('popular') popular?: string,
    @Query('new') isNew?: string,
  ) {
    return this.gamesService.listGames({
      category,
      search,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 24,
      popular: popular === 'true',
      isNew: isNew === 'true',
    });
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get game by slug' })
  async getOne(@Param('slug') slug: string) {
    return this.gamesService.getBySlug(slug);
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a game session' })
  async start(
    @Param('id') gameId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.gamesService.startSession(req.user.id, gameId);
  }

  @Post(':id/play')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Play a round (server-authoritative)' })
  async play(
    @Param('id') gameId: string,
    @Req() req: { user: { id: string } },
    @Body()
    body: {
      sessionId: string;
      betAmount: number;
      idempotencyKey: string;
      clientSeed?: string;
      betType?: string;
      betValue?: number | string;
      betOn?: 'player' | 'banker' | 'tie';
      autoCashout?: number;
      action?: 'hit' | 'stand' | 'auto';
    },
  ) {
    return this.gamesService.play(req.user.id, gameId, body);
  }
}
