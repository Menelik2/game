import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bonus } from './entities/bonus.entity';
import { UserBonus } from './entities/user-bonus.entity';
import { BonusesService } from './bonuses.service';
import { BonusesController } from './bonuses.controller';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([Bonus, UserBonus]), WalletModule],
  providers: [BonusesService],
  controllers: [BonusesController],
  exports: [BonusesService],
})
export class BonusesModule {}
