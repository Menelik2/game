import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Wallet } from './entities/wallet.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Transaction, TransactionType, TransactionStatus } from '../transactions/entities/transaction.entity';

const DEFAULT_DEMO_CREDITS = 10_000;

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(LedgerEntry) private readonly ledgerRepo: Repository<LedgerEntry>,
    @InjectRepository(Transaction) private readonly txRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async createDemoWallet(userId: string): Promise<Wallet> {
    const existing = await this.walletRepo.findOne({ where: { userId, currency: 'DEMO' } });
    if (existing) return existing;

    const credits = this.config.get<number>('SEED_DEMO_CREDITS', DEFAULT_DEMO_CREDITS);

    return this.dataSource.transaction(async (manager) => {
      const wallet = manager.create(Wallet, {
        userId,
        currency: 'DEMO',
        availableBalance: '0',
        lockedBalance: '0',
        bonusBalance: '0',
        status: 'ACTIVE',
      });
      const saved = await manager.save(wallet);
      await this.credit(
        manager,
        saved,
        credits,
        'DEMO_CREDIT',
        'Initial demo credits',
        `demo-seed-${userId}`,
      );
      return manager.findOneOrFail(Wallet, { where: { id: saved.id } });
    });
  }

  async getWallet(userId: string, currency = 'DEMO'): Promise<Wallet> {
    const wallet = await this.walletRepo.findOne({ where: { userId, currency } });
    if (!wallet) {
      throw new NotFoundException({ code: 'WALLET_NOT_FOUND', message: 'Wallet not found' });
    }
    return wallet;
  }

  async placeBet(
    userId: string,
    amount: number,
    idempotencyKey: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ wallet: Wallet; transaction: Transaction }> {
    if (amount <= 0) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Bet amount must be positive' });
    }

    const existing = await this.txRepo.findOne({ where: { idempotencyKey } });
    if (existing) {
      const wallet = await this.getWallet(userId);
      return { wallet, transaction: existing };
    }

    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { userId, currency: 'DEMO' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new NotFoundException({ code: 'WALLET_NOT_FOUND', message: 'Wallet not found' });
      }

      const available = parseFloat(wallet.availableBalance);
      if (available < amount) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient balance',
        });
      }

      const newAvailable = (available - amount).toFixed(4);
      wallet.availableBalance = newAvailable;
      await manager.save(wallet);

      const tx = manager.create(Transaction, {
        userId,
        walletId: wallet.id,
        type: 'BET' as TransactionType,
        amount: amount.toFixed(4),
        currency: wallet.currency,
        status: 'COMPLETED' as TransactionStatus,
        idempotencyKey,
        reference: `bet-${randomUUID().slice(0, 8)}`,
        metadata: metadata || null,
      });
      const savedTx = await manager.save(tx);

      await manager.save(
        manager.create(LedgerEntry, {
          walletId: wallet.id,
          transactionId: savedTx.id,
          entryType: 'DEBIT',
          amount: amount.toFixed(4),
          balanceAfter: newAvailable,
          description: 'Bet placed',
        }),
      );

      return { wallet, transaction: savedTx };
    });
  }

  async creditWin(
    userId: string,
    amount: number,
    idempotencyKey: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ wallet: Wallet; transaction: Transaction | null }> {
    if (amount < 0) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT', message: 'Win amount cannot be negative' });
    }

    const existing = await this.txRepo.findOne({ where: { idempotencyKey } });
    if (existing) {
      const wallet = await this.getWallet(userId);
      return { wallet, transaction: existing };
    }

    // Zero win: no ledger entry, return current wallet
    if (amount === 0) {
      const wallet = await this.getWallet(userId);
      return { wallet, transaction: null };
    }

    return this.dataSource.transaction(async (manager) => {
      const wallet = await manager.findOne(Wallet, {
        where: { userId, currency: 'DEMO' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new NotFoundException({ code: 'WALLET_NOT_FOUND', message: 'Wallet not found' });
      }

      const available = parseFloat(wallet.availableBalance);
      const newAvailable = (available + amount).toFixed(4);
      wallet.availableBalance = newAvailable;
      await manager.save(wallet);

      const tx = manager.create(Transaction, {
        userId,
        walletId: wallet.id,
        type: 'WIN' as TransactionType,
        amount: amount.toFixed(4),
        currency: wallet.currency,
        status: 'COMPLETED' as TransactionStatus,
        idempotencyKey,
        reference: `win-${randomUUID().slice(0, 8)}`,
        metadata: metadata || null,
      });
      const savedTx = await manager.save(tx);

      await manager.save(
        manager.create(LedgerEntry, {
          walletId: wallet.id,
          transactionId: savedTx.id,
          entryType: 'CREDIT',
          amount: amount.toFixed(4),
          balanceAfter: newAvailable,
          description: 'Win credited',
        }),
      );

      return { wallet, transaction: savedTx };
    });
  }

  private async credit(
    manager: EntityManager,
    wallet: Wallet,
    amount: number,
    type: TransactionType,
    description: string,
    idempotencyKey: string,
  ) {
    const available = parseFloat(wallet.availableBalance);
    const newAvailable = (available + amount).toFixed(4);
    wallet.availableBalance = newAvailable;
    await manager.save(wallet);

    const tx = manager.create(Transaction, {
      userId: wallet.userId,
      walletId: wallet.id,
      type,
      amount: amount.toFixed(4),
      currency: wallet.currency,
      status: 'COMPLETED',
      idempotencyKey,
      reference: description,
    });
    const savedTx = await manager.save(tx);

    await manager.save(
      manager.create(LedgerEntry, {
        walletId: wallet.id,
        transactionId: savedTx.id,
        entryType: 'CREDIT',
        amount: amount.toFixed(4),
        balanceAfter: newAvailable,
        description,
      }),
    );
  }

  async getTransactions(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.txRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
