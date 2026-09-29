import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Favorite } from './entities/favorite.entity';
import { Game } from './entities/game.entity';

@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(
    @InjectRepository(Favorite) private readonly favRepo: Repository<Favorite>,
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
  ) {}

  @Get()
  async list(@Req() req: { user: { id: string } }) {
    const favs = await this.favRepo.find({
      where: { userId: req.user.id },
      order: { createdAt: 'DESC' },
    });
    if (favs.length === 0) return { items: [] };
    const gameIds = favs.map((f) => f.gameId);
    const games = await this.gameRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.provider', 'p')
      .where('g.id IN (:...ids)', { ids: gameIds })
      .getMany();
    const map = new Map(games.map((g) => [g.id, g]));
    return {
      items: favs
        .map((f) => {
          const g = map.get(f.gameId);
          if (!g) return null;
          return {
            id: g.id,
            slug: g.slug,
            name: g.name,
            category: g.category,
            isNew: g.isNew,
            isPopular: g.isPopular,
            hasJackpot: g.hasJackpot,
            provider: g.provider ? { name: g.provider.name } : null,
            favoritedAt: f.createdAt,
          };
        })
        .filter(Boolean),
    };
  }

  @Post(':gameId')
  async add(@Req() req: { user: { id: string } }, @Param('gameId') gameId: string) {
    const game = await this.gameRepo.findOne({ where: { id: gameId } });
    if (!game) return { success: false, message: 'Game not found' };
    const existing = await this.favRepo.findOne({ where: { userId: req.user.id, gameId } });
    if (existing) return { success: true, favorite: existing };
    const fav = await this.favRepo.save(this.favRepo.create({ userId: req.user.id, gameId }));
    return { success: true, favorite: fav };
  }

  @Delete(':gameId')
  async remove(@Req() req: { user: { id: string } }, @Param('gameId') gameId: string) {
    await this.favRepo.delete({ userId: req.user.id, gameId });
    return { success: true };
  }
}
