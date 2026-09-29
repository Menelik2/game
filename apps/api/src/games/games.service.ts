import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Game } from './entities/game.entity';
import { GameSession } from './entities/game-session.entity';
import { GameRound } from './entities/game-round.entity';
import { GameEngineService } from './game-engine.service';
import { WalletService } from '../wallet/wallet.service';
import { ResponsibleGamingService } from '../responsible-gaming/responsible-gaming.service';
import { AuditService } from '../audit/audit.service';
import { EventsGateway } from '../realtime/events.gateway';

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
    @InjectRepository(GameSession) private readonly sessionRepo: Repository<GameSession>,
    @InjectRepository(GameRound) private readonly roundRepo: Repository<GameRound>,
    private readonly engine: GameEngineService,
    private readonly walletService: WalletService,
    private readonly rg: ResponsibleGamingService,
    private readonly audit: AuditService,
    private readonly events: EventsGateway,
    private readonly config: ConfigService,
  ) {}

  async listGames(query: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    popular?: boolean;
    isNew?: boolean;
  }) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 24, 100);
    const qb = this.gameRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.provider', 'p')
      .where('g.status = :status', { status: 'ACTIVE' });

    if (query.category && query.category !== 'POPULAR' && query.category !== 'NEW') {
      qb.andWhere('g.category = :cat', { cat: query.category });
    }
    if (query.popular || query.category === 'POPULAR') qb.andWhere('g.is_popular = true');
    if (query.isNew || query.category === 'NEW') qb.andWhere('g.is_new = true');
    if (query.search) {
      qb.andWhere('(g.name ILIKE :q OR g.slug ILIKE :q)', { q: `%${query.search}%` });
    }

    qb.orderBy('g.play_count', 'DESC').skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return {
      items: items.map((g) => this.serializeGame(g)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getBySlug(slug: string) {
    const game = await this.gameRepo.findOne({ where: { slug }, relations: ['provider'] });
    if (!game || game.status !== 'ACTIVE') {
      throw new NotFoundException({ code: 'GAME_UNAVAILABLE', message: 'Game not found' });
    }
    return this.serializeGame(game);
  }

  async startSession(userId: string, gameId: string) {
    await this.rg.assertCanPlay(userId);

    const game = await this.gameRepo.findOne({ where: { id: gameId, status: 'ACTIVE' } });
    if (!game) {
      throw new NotFoundException({ code: 'GAME_UNAVAILABLE', message: 'Game not available' });
    }

    await this.sessionRepo.update(
      { userId, gameId, status: 'ACTIVE' },
      { status: 'ENDED', endedAt: new Date() },
    );

    const serverSeed = this.engine.generateServerSeed();
    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        userId,
        gameId,
        status: 'ACTIVE',
        serverSeed,
        serverSeedHash: this.engine.hashServerSeed(serverSeed),
        clientSeed: randomUUID().slice(0, 16),
        nonce: 0,
        startedAt: new Date(),
      }),
    );

    await this.audit.log({
      userId,
      action: 'GAME_SESSION_STARTED',
      entity: 'game_session',
      entityId: session.id,
      metadata: { gameId, gameSlug: game.slug },
    });

    return {
      sessionId: session.id,
      gameId: game.id,
      gameSlug: game.slug,
      serverSeedHash: session.serverSeedHash,
      clientSeed: session.clientSeed,
      minBet: parseFloat(game.minBet),
      maxBet: parseFloat(game.maxBet),
    };
  }

  async play(
    userId: string,
    gameId: string,
    dto: {
      sessionId: string;
      betAmount: number;
      idempotencyKey: string;
      clientSeed?: string;
    },
  ) {
    await this.rg.assertCanPlay(userId);

    if (this.config.get('REAL_MONEY_ENABLED') === true && !this.config.get('DEMO_MODE')) {
      throw new ForbiddenException({
        code: 'REAL_MONEY_DISABLED',
        message: 'Real-money play is not enabled',
      });
    }

    const session = await this.sessionRepo.findOne({
      where: { id: dto.sessionId, userId, gameId, status: 'ACTIVE' },
    });
    if (!session || !session.serverSeed) {
      throw new BadRequestException({ code: 'SESSION_INVALID', message: 'Invalid or expired session' });
    }

    const game = await this.gameRepo.findOne({ where: { id: gameId, status: 'ACTIVE' } });
    if (!game) {
      throw new NotFoundException({ code: 'GAME_UNAVAILABLE', message: 'Game not found' });
    }

    const minBet = parseFloat(game.minBet);
    const maxBet = parseFloat(game.maxBet);
    if (dto.betAmount < minBet || dto.betAmount > maxBet) {
      throw new BadRequestException({
        code: 'BET_LIMIT_EXCEEDED',
        message: `Bet must be between ${minBet} and ${maxBet}`,
      });
    }

    const existingRound = await this.roundRepo.findOne({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existingRound) {
      const wallet = await this.walletService.getWallet(userId);
      return {
        roundId: existingRound.id,
        result: existingRound.resultData,
        stake: parseFloat(existingRound.betAmount),
        win: parseFloat(existingRound.winAmount),
        balance: parseFloat(wallet.availableBalance),
        reused: true,
      };
    }

    const { wallet: afterBet, transaction: betTx } = await this.walletService.placeBet(
      userId,
      dto.betAmount,
      `${dto.idempotencyKey}:bet`,
      { gameId, sessionId: session.id },
    );

    const nonce = session.nonce + 1;
    const clientSeed = dto.clientSeed || session.clientSeed || 'default';
    const serverSeed = session.serverSeed;

    let resultData: Record<string, unknown>;
    let winAmount = 0;
    let resultHash: string;

    if (game.category === 'ROULETTE') {
      const outcome = this.engine.spinRoulette({
        serverSeed,
        clientSeed,
        nonce,
        bets: [{ type: 'red', amount: dto.betAmount }],
      });
      winAmount = outcome.totalWin;
      resultHash = outcome.resultHash;
      resultData = { type: 'roulette', ...outcome };
    } else if (game.category === 'CRASH') {
      const outcome = this.engine.generateCrashPoint({ serverSeed, clientSeed, nonce });
      const autoCashout = 1.5;
      winAmount =
        outcome.crashPoint >= autoCashout
          ? Math.round(dto.betAmount * autoCashout * 100) / 100
          : 0;
      resultHash = outcome.resultHash;
      resultData = {
        type: 'crash',
        crashPoint: outcome.crashPoint,
        autoCashout,
        cashedOut: winAmount > 0,
      };
    } else if (game.category === 'BLACKJACK') {
      const outcome = this.engine.playBlackjack({
        serverSeed,
        clientSeed,
        nonce,
        betAmount: dto.betAmount,
        action: 'stand',
      });
      winAmount = outcome.winAmount;
      resultHash = outcome.resultHash;
      resultData = { type: 'blackjack', ...outcome };
    } else if (game.category === 'BACCARAT') {
      const outcome = this.engine.playBaccarat({
        serverSeed,
        clientSeed,
        nonce,
        betAmount: dto.betAmount,
        betOn: 'player',
      });
      winAmount = outcome.winAmount;
      resultHash = outcome.resultHash;
      resultData = { type: 'baccarat', ...outcome };
    } else {
      const outcome = this.engine.spinSlot({
        serverSeed,
        clientSeed,
        nonce,
        betAmount: dto.betAmount,
      });
      winAmount = outcome.winAmount;
      resultHash = outcome.resultHash;
      resultData = { type: 'slots', ...outcome };
    }

    let winTxId: string | null = null;
    let finalWallet = afterBet;
    if (winAmount > 0) {
      const { wallet, transaction } = await this.walletService.creditWin(
        userId,
        winAmount,
        `${dto.idempotencyKey}:win`,
        { gameId, sessionId: session.id, roundNonce: nonce },
      );
      finalWallet = wallet;
      winTxId = transaction?.id ?? null;
    }

    const savedRound = await this.roundRepo.save(
      this.roundRepo.create({
        sessionId: session.id,
        userId,
        gameId,
        roundNumber: nonce,
        betAmount: dto.betAmount.toFixed(4),
        winAmount: winAmount.toFixed(4),
        resultHash,
        resultData,
        betTransactionId: betTx.id,
        winTransactionId: winTxId,
        idempotencyKey: dto.idempotencyKey,
      }),
    );

    session.nonce = nonce;
    if (dto.clientSeed) session.clientSeed = dto.clientSeed;
    await this.sessionRepo.save(session);
    await this.gameRepo.increment({ id: gameId }, 'playCount', 1);

    this.events.emitWalletUpdate(userId, {
      availableBalance: parseFloat(finalWallet.availableBalance),
      lockedBalance: parseFloat(finalWallet.lockedBalance),
      bonusBalance: parseFloat(finalWallet.bonusBalance),
      currency: finalWallet.currency,
    });

    return {
      roundId: savedRound.id,
      result: resultData,
      stake: dto.betAmount,
      win: winAmount,
      balance: parseFloat(finalWallet.availableBalance),
      serverTimestamp: savedRound.createdAt.toISOString(),
      nonce,
    };
  }

  private serializeGame(g: Game) {
    return {
      id: g.id,
      slug: g.slug,
      name: g.name,
      category: g.category,
      status: g.status,
      thumbnail: g.thumbnail,
      description: g.description,
      minBet: parseFloat(g.minBet),
      maxBet: parseFloat(g.maxBet),
      isNew: g.isNew,
      isPopular: g.isPopular,
      hasJackpot: g.hasJackpot,
      playCount: g.playCount,
      provider: g.provider
        ? { id: g.provider.id, name: g.provider.name, slug: g.provider.slug }
        : null,
    };
  }
}
