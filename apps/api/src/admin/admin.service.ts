import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
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
import * as argon2 from 'argon2';
import { normalizePhone } from '../auth/auth.service';

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

  /** CREATE */
  async createUser(input: {
    fullName: string;
    phone: string;
    password: string;
    isAdmin?: boolean;
    status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
    initialBalance?: number;
  }) {
    const fullName = (input.fullName || '').trim().replace(/\s+/g, ' ');
    if (fullName.length < 2) {
      throw new BadRequestException({ message: 'Full name required (min 2)' });
    }
    const phone = normalizePhone(input.phone || '');
    if (!phone) {
      throw new BadRequestException({
        message: 'Valid Ethiopian phone required (09xxxxxxxx)',
      });
    }
    if (!input.password || input.password.length < 6) {
      throw new BadRequestException({ message: 'Password min 6 characters' });
    }

    const existing = await this.userRepo.findOne({ where: { phone } });
    if (existing) {
      throw new ConflictException({ message: 'Phone already registered' });
    }

    const email = `${phone.replace('+', '')}@phone.equb.local`;
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const parts = fullName.split(' ');
    const user = await this.userRepo.save(
      this.userRepo.create({
        email,
        phone,
        passwordHash,
        status: input.status || 'ACTIVE',
        isAdmin: !!input.isAdmin,
        adminRoles: input.isAdmin ? ['ADMIN'] : null,
        country: 'ET',
        emailVerifiedAt: new Date(),
      }),
    );

    await this.profileRepo.save(
      this.profileRepo.create({
        userId: user.id,
        firstName: parts[0] || fullName,
        lastName: parts.slice(1).join(' ') || null,
        language: 'am',
      }),
    );

    const startBal = Math.max(0, Number(input.initialBalance) || 5000);
    if (startBal > 0) {
      await this.creditUser(user.id, startBal, 'Admin create — initial balance');
    }

    await this.auditRepo.save(
      this.auditRepo.create({
        userId: user.id,
        action: 'ADMIN_CREATE_USER',
        entity: 'user',
        entityId: user.id,
        metadata: { phone, isAdmin: !!input.isAdmin },
      }),
    );

    return this.getUser(user.id);
  }

  /** UPDATE */
  async updateUser(
    userId: string,
    input: {
      fullName?: string;
      phone?: string;
      status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
      isAdmin?: boolean;
      password?: string;
      country?: string;
    },
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException({ message: 'User not found' });

    if (input.phone !== undefined) {
      const phone = normalizePhone(input.phone);
      if (!phone) throw new BadRequestException({ message: 'Invalid phone' });
      const clash = await this.userRepo.findOne({ where: { phone } });
      if (clash && clash.id !== userId) {
        throw new ConflictException({ message: 'Phone already in use' });
      }
      user.phone = phone;
      user.email = `${phone.replace('+', '')}@phone.equb.local`;
    }

    if (input.status) user.status = input.status;
    if (typeof input.isAdmin === 'boolean') {
      user.isAdmin = input.isAdmin;
      user.adminRoles = input.isAdmin ? user.adminRoles?.length ? user.adminRoles : ['ADMIN'] : null;
    }
    if (input.country) user.country = input.country.slice(0, 2).toUpperCase();

    if (input.password && input.password.length >= 6) {
      user.passwordHash = await argon2.hash(input.password, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
    }

    if (input.status === 'ACTIVE') {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    }

    await this.userRepo.save(user);

    if (input.fullName !== undefined) {
      const fullName = input.fullName.trim().replace(/\s+/g, ' ');
      if (fullName.length >= 2) {
        const parts = fullName.split(' ');
        let profile = await this.profileRepo.findOne({ where: { userId } });
        if (!profile) {
          profile = this.profileRepo.create({
            userId,
            firstName: parts[0],
            lastName: parts.slice(1).join(' ') || null,
            language: 'am',
          });
        } else {
          profile.firstName = parts[0] || fullName;
          profile.lastName = parts.slice(1).join(' ') || null;
        }
        await this.profileRepo.save(profile);
      }
    }

    await this.auditRepo.save(
      this.auditRepo.create({
        userId,
        action: 'ADMIN_UPDATE_USER',
        entity: 'user',
        entityId: userId,
        metadata: { fields: Object.keys(input) },
      }),
    );

    return this.getUser(userId);
  }

  /** DELETE — soft close by default; hard=true removes row */
  async deleteUser(userId: string, hard = false) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException({ message: 'User not found' });

    if (hard) {
      await this.profileRepo.delete({ userId });
      // Keep wallet/tx history; only detach profile + close user
      await this.userRepo.delete({ id: userId });
      await this.auditRepo.save(
        this.auditRepo.create({
          action: 'ADMIN_HARD_DELETE_USER',
          entity: 'user',
          entityId: userId,
        }),
      );
      return { id: userId, deleted: true, hard: true };
    }

    user.status = 'CLOSED';
    user.isAdmin = false;
    await this.userRepo.save(user);
    await this.auditRepo.save(
      this.auditRepo.create({
        userId,
        action: 'ADMIN_SOFT_DELETE_USER',
        entity: 'user',
        entityId: userId,
      }),
    );
    return { id: userId, deleted: true, hard: false, status: 'CLOSED' };
  }

  async setUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED') {
    return this.updateUser(userId, { status });
  }

  async setUserAdmin(userId: string, isAdmin: boolean) {
    return this.updateUser(userId, { isAdmin });
  }

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
