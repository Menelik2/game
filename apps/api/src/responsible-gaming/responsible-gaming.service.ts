import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { SelfExclusion } from './entities/self-exclusion.entity';
import { ResponsibleGamingLimit } from './entities/responsible-gaming-limit.entity';

@Injectable()
export class ResponsibleGamingService {
  constructor(
    @InjectRepository(SelfExclusion)
    private readonly exclusionRepo: Repository<SelfExclusion>,
    @InjectRepository(ResponsibleGamingLimit)
    private readonly limitRepo: Repository<ResponsibleGamingLimit>,
  ) {}

  async assertCanPlay(userId: string) {
    const active = await this.exclusionRepo.findOne({
      where: {
        userId,
        status: 'ACTIVE',
        endAt: MoreThan(new Date()),
      },
    });
    if (active) {
      throw new ForbiddenException({
        code: 'SELF_EXCLUDED',
        message: 'Your account is under self-exclusion. Gameplay is blocked.',
      });
    }
  }

  async getLimits(userId: string) {
    let limits = await this.limitRepo.findOne({ where: { userId } });
    if (!limits) {
      limits = this.limitRepo.create({ userId });
      await this.limitRepo.save(limits);
    }
    return limits;
  }

  async setLimits(
    userId: string,
    data: Partial<{
      dailyDepositLimit: number | null;
      weeklyDepositLimit: number | null;
      monthlyDepositLimit: number | null;
      dailyLossLimit: number | null;
      sessionLimitMinutes: number | null;
    }>,
  ) {
    let limits = await this.limitRepo.findOne({ where: { userId } });
    if (!limits) limits = this.limitRepo.create({ userId });
    if (data.dailyDepositLimit !== undefined)
      limits.dailyDepositLimit = data.dailyDepositLimit?.toString() ?? null;
    if (data.weeklyDepositLimit !== undefined)
      limits.weeklyDepositLimit = data.weeklyDepositLimit?.toString() ?? null;
    if (data.monthlyDepositLimit !== undefined)
      limits.monthlyDepositLimit = data.monthlyDepositLimit?.toString() ?? null;
    if (data.dailyLossLimit !== undefined)
      limits.dailyLossLimit = data.dailyLossLimit?.toString() ?? null;
    if (data.sessionLimitMinutes !== undefined)
      limits.sessionLimitMinutes = data.sessionLimitMinutes;
    return this.limitRepo.save(limits);
  }

  async selfExclude(userId: string, durationDays: number, reason?: string) {
    const startAt = new Date();
    const endAt = new Date(startAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
    return this.exclusionRepo.save(
      this.exclusionRepo.create({
        userId,
        startAt,
        endAt,
        reason: reason || null,
        status: 'ACTIVE',
      }),
    );
  }

  async getActiveExclusion(userId: string) {
    return this.exclusionRepo.findOne({
      where: { userId, status: 'ACTIVE', endAt: MoreThan(new Date()) },
    });
  }
}
