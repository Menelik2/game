import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from './entities/game.entity';
import { GameProvider } from './entities/game-provider.entity';
import { GameSession } from './entities/game-session.entity';
import { GameRound } from './entities/game-round.entity';
import { Favorite } from './entities/favorite.entity';
import { FavoritesController } from './favorites.controller';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { GameEngineService } from './game-engine.service';
import { WalletModule } from '../wallet/wallet.module';
import { ResponsibleGamingModule } from '../responsible-gaming/responsible-gaming.module';
import { AuditModule } from '../audit/audit.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, GameProvider, GameSession, GameRound, Favorite]),
    WalletModule,
    ResponsibleGamingModule,
    AuditModule,
    RealtimeModule,
  ],
  providers: [GamesService, GameEngineService],
  controllers: [GamesController, FavoritesController],
  exports: [GamesService, GameEngineService],
})
export class GamesModule {}
