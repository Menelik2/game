import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { Game } from '../games/entities/game.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { LedgerEntry } from '../wallet/entities/ledger-entry.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserProfile,
      Game,
      Transaction,
      Wallet,
      AuditLog,
      LedgerEntry,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
