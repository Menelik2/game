import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Game } from '../games/entities/game.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
  ) {}

  async dashboard() {
    const [users, games, txs] = await Promise.all([
      this.userRepo.count(),
      this.gameRepo.count({ where: { status: 'ACTIVE' } }),
      this.txRepo.count(),
    ]);
    const recentTx = await this.txRepo.find({
      order: { createdAt: 'DESC' },
      take: 10,
    });
    return {
      registeredUsers: users,
      activeGames: games,
      totalTransactions: txs,
      recentTransactions: recentTx,
      demoMode: true,
    };
  }

  async listUsers(page = 1, limit = 20) {
    const [items, total] = await this.userRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        status: u.status,
        country: u.country,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
