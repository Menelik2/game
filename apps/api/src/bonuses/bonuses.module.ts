import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bonus } from './entities/bonus.entity';
import { UserBonus } from './entities/user-bonus.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { LedgerEntry } from '../wallet/entities/ledger-entry.entity';
import { BonusesService } from './bonuses.service';
import { BonusesController } from './bonuses.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bonus, UserBonus, Wallet, Transaction, LedgerEntry]),
  ],
  providers: [BonusesService],
  controllers: [BonusesController],
  exports: [BonusesService],
})
export class BonusesModule {}
