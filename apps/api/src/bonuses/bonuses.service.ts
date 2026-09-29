import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bonus } from './entities/bonus.entity';
import { UserBonus } from './entities/user-bonus.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { LedgerEntry } from '../wallet/entities/ledger-entry.entity';

@Injectable()
export class BonusesService {
  constructor(
    @InjectRepository(Bonus) private readonly bonusRepo: Repository<Bonus>,
    @InjectRepository(UserBonus) private readonly userBonusRepo: Repository<UserBonus>,
    private readonly dataSource: DataSource,
  ) {}

  async listActive() {
    const now = new Date();
    const items = await this.bonusRepo
      .createQueryBuilder('b')
      .where('b.status = :status', { status: 'ACTIVE' })
      .andWhere('(b.start_at IS NULL OR b.start_at <= :now)', { now })
      .andWhere('(b.end_at IS NULL OR b.end_at >= :now)', { now })
      .getMany();
    return { items };
  }

  async listMine(userId: string) {
    return {
      items: await this.userBonusRepo.find({
        where: { userId },
        order: { claimedAt: 'DESC' },
      }),
    };
  }

  async claim(userId: string, bonusId: string) {
    const bonus = await this.bonusRepo.findOne({ where: { id: bonusId, status: 'ACTIVE' } });
    if (!bonus) {
      throw new NotFoundException({ code: 'BONUS_NOT_FOUND', message: 'Bonus not found' });
    }
    const now = new Date();
    if (bonus.startAt && bonus.startAt > now) {
      throw new BadRequestException({ code: 'BONUS_NOT_STARTED', message: 'Bonus not yet available' });
    }
    if (bonus.endAt && bonus.endAt < now) {
      throw new BadRequestException({ code: 'BONUS_EXPIRED', message: 'Bonus has expired' });
    }

    const existing = await this.userBonusRepo.findOne({
      where: { userId, bonusId, status: 'ACTIVE' },
    });
    if (existing) {
      throw new BadRequestException({ code: 'BONUS_ALREADY_CLAIMED', message: 'Already claimed' });
    }

    const amount = parseFloat(bonus.value);

    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { userId, currency: 'DEMO' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet || wallet.status !== 'ACTIVE') {
        throw new ForbiddenException({ code: 'WALLET_LOCKED', message: 'Wallet unavailable' });
      }

      const creditAvailable =
        bonus.type === 'WELCOME_BONUS' || bonus.type === 'LOYALTY_REWARD';
      if (creditAvailable) {
        wallet.availableBalance = (parseFloat(wallet.availableBalance) + amount).toFixed(4);
      } else {
        wallet.bonusBalance = (parseFloat(wallet.bonusBalance) + amount).toFixed(4);
      }
      await manager.save(wallet);

      const tx = manager.create(Transaction, {
        userId,
        walletId: wallet.id,
        type: 'BONUS',
        amount: amount.toFixed(4),
        currency: wallet.currency,
        status: 'COMPLETED',
        idempotencyKey: `bonus-claim-${userId}-${bonusId}`,
        reference: `bonus:${bonus.name}`,
        metadata: { bonusId, bonusType: bonus.type },
      });
      const savedTx = await manager.save(tx);

      await manager.save(
        manager.create(LedgerEntry, {
          walletId: wallet.id,
          transactionId: savedTx.id,
          entryType: 'CREDIT',
          amount: amount.toFixed(4),
          balanceAfter: wallet.availableBalance,
          description: `Bonus: ${bonus.name}`,
        }),
      );

      const expiresAt = bonus.endAt
        ? bonus.endAt
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      const userBonus = await manager.save(
        manager.create(UserBonus, {
          userId,
          bonusId,
          amount: amount.toFixed(4),
          remaining: amount.toFixed(4),
          wageringProgress: '0',
          status: 'ACTIVE',
          claimedAt: now,
          expiresAt,
        }),
      );

      return {
        userBonus,
        wallet: {
          availableBalance: parseFloat(wallet.availableBalance),
          bonusBalance: parseFloat(wallet.bonusBalance),
        },
      };
    });
  }
}
