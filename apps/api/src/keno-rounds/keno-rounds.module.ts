import { Module } from '@nestjs/common';
import { KenoRoundsService } from './keno-rounds.service';
import { KenoRoundsController } from './keno-rounds.controller';
import { GamesModule } from '../games/games.module';

@Module({
  imports: [GamesModule],
  controllers: [KenoRoundsController],
  providers: [KenoRoundsService],
  exports: [KenoRoundsService],
})
export class KenoRoundsModule {}
