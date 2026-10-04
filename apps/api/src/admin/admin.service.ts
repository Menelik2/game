import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserProfile } from '../users/entities/user-profile.entity';
import { Game } from '../games/entities/game.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { Wallet } from '../wallet/entities/wallet.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { LedgerEntry } from '../wallet/entities/ledger-entry.entity';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile) private readonly profileRepo: Repository<UserProfile>,
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Wallet) private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(LedgerEntry) private readonly ledgerRepo: Repository<LedgerEntry>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async dashboard() {
    const now = Date.now();
    const since24h = new Date(now - 24 * 60 * 60 * 1000);
    const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      users,
      activeUsers,
      suspendedUsers,
      adminUsers,
      games,
      txs,
      txs24h,
      users7d,
      wallets,
    ] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { status: 'ACTIVE' } }),
      this.userRepo.count({ where: { status: 'SUSPENDED' } }),
      this.userRepo.count({ where: { isAdmin: true } }),
      this.gameRepo.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
      this.txRepo.count().catch(() => 0),
      this.txRepo
        .createQueryBuilder('t')
        .where('t.created_at >= :since', { since: since24h })
        .getCount()
        .catch(() => 0),
      this.userRepo
        .createQueryBuilder('u')
        .where('u.created_at >= :since', { since: since7d })
        .getCount()
        .catch(() => 0),
      this.walletRepo.find({ take: 2000 }).catch(() => [] as Wallet[]),
    ]);

    let totalDemoBalance = 0;
    for (const w of wallets) {
      totalDemoBalance += parseFloat(String(w.availableBalance || 0)) || 0;
    }

    // Signups per day (last 7 days)
    const signupsByDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now - i * 24 * 60 * 60 * 1000);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const count = await this.userRepo
        .createQueryBuilder('u')
        .where('u.created_at >= :a AND u.created_at <= :b', {
          a: dayStart,
          b: dayEnd,
        })
        .getCount()
        .catch(() => 0);
      signupsByDay.push({
        date: dayStart.toISOString().slice(0, 10),
        count,
      });
    }

    const recentUsers = await this.userRepo.find({
      order: { createdAt: 'DESC' },
      take: 10,
    });
    const profiles = await this.profileRepo
      .find({ where: recentUsers.map((u) => ({ userId: u.id })) })
      .catch(() => [] as UserProfile[]);
    const nameByUser = new Map(
      profiles.map((p) => [
        p.userId,
        [p.firstName, p.lastName].filter(Boolean).join(' '),
      ]),
    );

    const recentTx = await this.txRepo
      .find({ order: { createdAt: 'DESC' }, take: 20 })
      .catch(() => []);

    const recentAudit = await this.auditRepo
      .find({ order: { createdAt: 'DESC' }, take: 20 })
      .catch(() => []);

    return {
      registeredUsers: users,
      activeUsers,
      suspendedUsers,
      adminUsers,
      activeGames: games,
      totalTransactions: txs,
      transactionsLast24h: txs24h,
      newUsersLast7d: users7d,
      totalDemoBalance: Math.round(totalDemoBalance * 100) / 100,
      demoMode: this.config.get('DEMO_MODE') !== false,
      realMoneyEnabled: this.config.get('REAL_MONEY_ENABLED') === true,
      signupsByDay,
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
      recentAudit: recentAudit.map((a) => ({
        id: a.id,
        userId: a.userId,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        createdAt: a.createdAt,
      })),
    };
  }

  async systemHealth() {
    let dbOk = false;
    try {
      await this.dataSource.query('SELECT 1');
      dbOk = true;
    } catch {
      dbOk = false;
    }
    return {
      ok: dbOk,
      database: dbOk ? 'up' : 'down',
      demoMode: this.config.get('DEMO_MODE') !== false,
      realMoneyEnabled: this.config.get('REAL_MONEY_ENABLED') === true,
      nodeEnv: this.config.get('NODE_ENV') || process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
  }

  async listUsers(page = 1, limit = 20, q?: string, status?: string) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .orderBy('u.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (q?.trim()) {
      const term = `%${q.trim()}%`;
      qb.andWhere('(u.email ILIKE :term OR u.phone ILIKE :term)', { term });
    }
    if (status && ['ACTIVE', 'SUSPENDED', 'CLOSED'].includes(status)) {
      qb.andWhere('u.status = :status', { status });
    }

    const [items, total] = await qb.getManyAndCount();
    const profiles = await this.profileRepo
      .find({ where: items.map((u) => ({ userId: u.id })) })
      .catch(() => [] as UserProfile[]);
    const nameByUser = new Map(
      profiles.map((p) => [
        p.userId,
        [p.firstName, p.lastName].filter(Boolean).join(' '),
      ]),
    );
    const wallets = await this.walletRepo
      .find({ where: items.map((u) => ({ userId: u.id, currency: 'DEMO' })) })
      .catch(() => [] as Wallet[]);
    const balByUser = new Map(
      wallets.map((w) => [
        w.userId,
        parseFloat(String(w.availableBalance || 0)) || 0,
      ]),
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

  async getUser(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });

    const profile = await this.profileRepo.findOne({ where: { userId } });
    const wallet = await this.walletRepo.findOne({
      where: { userId, currency: 'DEMO' },
    });
    const txs = await this.txRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 30,
    });
    const audits = await this.auditRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || null,
      status: user.status,
      country: user.country,
      isAdmin: user.isAdmin,
      adminRoles: user.adminRoles,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      createdAt: user.createdAt,
      balance: wallet ? parseFloat(String(wallet.availableBalance || 0)) || 0 : 0,
      walletId: wallet?.id || null,
      transactions: txs.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        createdAt: t.createdAt,
      })),
      audit: audits.map((a) => ({
        id: a.id,
        action: a.action,
        entity: a.entity,
        createdAt: a.createdAt,
      })),
    };
  }

  async setUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED') {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    user.status = status;
    if (status === 'ACTIVE') {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    }
    await this.userRepo.save(user);
    await this.auditRepo.save(
      this.auditRepo.create({
        userId,
        action: `ADMIN_SET_STATUS_${status}`,
        entity: 'user',
        entityId: userId,
      }),
    );
    return { id: user.id, status: user.status, phone: user.phone, email: user.email };
  }

  async setUserAdmin(userId: string, isAdmin: boolean) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    user.isAdmin = isAdmin;
    user.adminRoles = isAdmin ? user.adminRoles?.length ? user.adminRoles : ['ADMIN'] : null;
    await this.userRepo.save(user);
    await this.auditRepo.save(
      this.auditRepo.create({
        userId,
        action: isAdmin ? 'ADMIN_GRANT' : 'ADMIN_REVOKE',
        entity: 'user',
        entityId: userId,
      }),
    );
    return { id: user.id, isAdmin: user.isAdmin };
  }

  /** Credit demo wallet (demo mode only) */
  async creditUser(userId: string, amount: number, note?: string) {
    if (!amount || amount <= 0 || amount > 1_000_000) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Amount must be between 1 and 1,000,000',
      });
    }

    let wallet = await this.walletRepo.findOne({ where: { userId, currency: 'DEMO' } });
    if (!wallet) {
      wallet = await this.walletRepo.save(
        this.walletRepo.create({
          userId,
          currency: 'DEMO',
          availableBalance: '0',
          lockedBalance: '0',
          bonusBalance: '0',
          status: 'ACTIVE',
        }),
      );
    }

    const available = parseFloat(String(wallet.availableBalance || 0)) || 0;
    const newBal = (available + amount).toFixed(4);
    wallet.availableBalance = newBal;
    await this.walletRepo.save(wallet);

    const tx = await this.txRepo.save(
      this.txRepo.create({
        userId,
        walletId: wallet.id,
        type: 'DEMO_CREDIT',
        amount: amount.toFixed(4),
        currency: 'DEMO',
        status: 'COMPLETED',
        idempotencyKey: `admin-credit-${userId}-${randomUUID()}`,
        reference: note || 'Admin credit',
      }),
    );

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        walletId: wallet.id,
        transactionId: tx.id,
        entryType: 'CREDIT',
        amount: amount.toFixed(4),
        balanceAfter: newBal,
        description: note || 'Admin credit',
      }),
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        userId,
        action: 'ADMIN_CREDIT',
        entity: 'wallet',
        entityId: wallet.id,
        metadata: { amount, note: note || null },
      }),
    );

    return {
      userId,
      balance: parseFloat(newBal),
      credited: amount,
    };
  }

  async listAudit(page = 1, limit = 30) {
    const [items, total] = await this.auditRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items: items.map((a) => ({
        id: a.id,
        userId: a.userId,
        adminId: a.adminId,
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        metadata: a.metadata,
        createdAt: a.createdAt,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}
