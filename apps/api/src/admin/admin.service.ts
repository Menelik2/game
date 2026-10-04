import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { Game } from '../games/entities/game.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Wallet } from '../wallet/entities/wallet.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile) private readonly profileRepo: Repository<UserProfile>,
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Wallet) private readonly walletRepo: Repository<Wallet>,
  ) {}

  async dashboard() {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [users, activeUsers, games, txs, txs24h, wallets] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { status: 'ACTIVE' } }),
      this.gameRepo.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
      this.txRepo.count().catch(() => 0),
      this.txRepo
        .createQueryBuilder('t')
        .where('t.created_at >= :since', { since: since24h })
        .getCount()
        .catch(() => 0),
      this.walletRepo.find({ take: 500 }).catch(() => [] as Wallet[]),
    ]);

    let totalDemoBalance = 0;
    for (const w of wallets) {
      totalDemoBalance += parseFloat(String(w.availableBalance || 0)) || 0;
    }

    const recentUsers = await this.userRepo.find({
      order: { createdAt: 'DESC' },
      take: 8,
    });

    const profiles = await this.profileRepo.find({
      where: recentUsers.map((u) => ({ userId: u.id })),
    }).catch(() => [] as UserProfile[]);

    const nameByUser = new Map(
      profiles.map((p) => [
        p.userId,
        [p.firstName, p.lastName].filter(Boolean).join(' '),
      ]),
    );

    const recentTx = await this.txRepo
      .find({ order: { createdAt: 'DESC' }, take: 15 })
      .catch(() => []);

    return {
      registeredUsers: users,
      activeUsers,
      activeGames: games,
      totalTransactions: txs,
      transactionsLast24h: txs24h,
      totalDemoBalance: Math.round(totalDemoBalance * 100) / 100,
      demoMode: process.env.DEMO_MODE !== 'false',
      recentUsers: recentUsers.map((u) => ({
        id: u.id,
        phone: u.phone,
        email: u.email,
        fullName: nameByUser.get(u.id) || null,
        status: u.status,
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
      })),
      recentTransactions: recentTx.map((t) => ({
        id: t.id,
        userId: t.userId,
        type: t.type,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        createdAt: t.createdAt,
      })),
    };
  }

  async listUsers(page = 1, limit = 20, q?: string) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (q?.trim()) {
      const term = `%${q.trim()}%`;
      qb.andWhere(
        '(u.email ILIKE :term OR u.phone ILIKE :term)',
        { term },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    const profiles = await this.profileRepo.find({
      where: items.map((u) => ({ userId: u.id })),
    }).catch(() => [] as UserProfile[]);
    const nameByUser = new Map(
      profiles.map((p) => [
        p.userId,
        [p.firstName, p.lastName].filter(Boolean).join(' '),
      ]),
    );

    const wallets = await this.walletRepo.find({
      where: items.map((u) => ({ userId: u.id, currency: 'DEMO' })),
    }).catch(() => [] as Wallet[]);
    const balByUser = new Map(
      wallets.map((w) => [w.userId, parseFloat(String(w.availableBalance || 0)) || 0]),
    );

    return {
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        fullName: nameByUser.get(u.id) || null,
        status: u.status,
        country: u.country,
        isAdmin: u.isAdmin,
        balance: balByUser.get(u.id) ?? 0,
        createdAt: u.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async setUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED') {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }
    user.status = status;
    await this.userRepo.save(user);
    return {
      id: user.id,
      status: user.status,
      phone: user.phone,
      email: user.email,
    };
  }

  async setUserAdmin(userId: string, isAdmin: boolean) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }
    user.isAdmin = isAdmin;
    await this.userRepo.save(user);
    return { id: user.id, isAdmin: user.isAdmin };
  }
}
