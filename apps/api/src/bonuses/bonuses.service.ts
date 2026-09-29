import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bonus } from './entities/bonus.entity';
import { UserBonus } from './entities/user-bonus.entity';
import { WalletService } from '../wallet/wallet.service';
import { randomUUID } from 'crypto';

@Injectable()
export class BonusesService {
  constructor(
    @InjectRepository(Bonus) private readonly bonusRepo: Repository<Bonus>,
    @InjectRepository(UserBonus) private readonly userBonusRepo: Repository<UserBonus>,
    private readonly walletService: WalletService,
  ) {}

  listActive() {
    return this.bonusRepo.find({ where: { status: 'ACTIVE' } });
  }

  async claim(userId: string, bonusId: string) {
    const bonus = await this.bonusRepo.findOne({ where: { id: bonusId, status: 'ACTIVE' } });
    if (!bonus) throw new NotFoundException('Bonus not found');

    const existing = await this.userBonusRepo.findOne({
      where: { userId, bonusId, status: 'ACTIVE' },
    });
    if (existing) throw new BadRequestException('Bonus already claimed');

    const amount = parseFloat(bonus.amount);
    const wagering = amount * parseFloat(bonus.wageringRequirement);

    const userBonus = await this.userBonusRepo.save(
      this.userBonusRepo.create({
        userId,
        bonusId,
        status: 'ACTIVE',
        amountGranted: amount.toFixed(4),
        wageringProgress: '0',
        wageringRequired: wagering.toFixed(4),
      }),
    );

    // Credit as demo bonus via wallet win path with unique key
    await this.walletService.creditWin(userId, amount, `bonus-claim-${userBonus.id}`, {
      bonusId,
      type: 'BONUS_CLAIM',
    });

    return userBonus;
  }

  async myBonuses(userId: string) {
    return this.userBonusRepo.find({ where: { userId }, order: { claimedAt: 'DESC' } });
  }
}
