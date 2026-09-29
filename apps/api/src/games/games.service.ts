import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Game } from './entities/game.entity';
import { GameSession } from './entities/game-session.entity';
import { GameRound } from './entities/game-round.entity';
import { GameEngineService } from './game-engine.service';
import { WalletService } from '../wallet/wallet.service';
import { ResponsibleGamingService } from '../responsible-gaming/responsible-gaming.service';
import { AuditService } from '../audit/audit.service';

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
  ) {}

  async listGames(opts: {
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
    popular?: boolean;
    isNew?: boolean;
  }) {
    const page = opts.page || 1;
    const limit = Math.min(opts.limit || 24, 100);
    const qb = this.gameRepo
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.provider', 'p')
      .where('g.status = :status', { status: 'ACTIVE' });

    if (opts.category) qb.andWhere('g.category = :category', { category: opts.category });
    if (opts.search) qb.andWhere('g.name ILIKE :q', { q: `%${opts.search}%` });
    if (opts.popular) qb.andWhere('g.is_popular = true');
    if (opts.isNew) qb.andWhere('g.is_new = true');

    qb.orderBy('g.is_popular', 'DESC').addOrderBy('g.play_count', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

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
    if (!game) throw new NotFoundException({ code: 'GAME_UNAVAILABLE', message: 'Game not found' });

    const serverSeed = this.engine.generateServerSeed();
    const session = await this.sessionRepo.save(
      this.sessionRepo.create({
        userId,
        gameId,
        status: 'ACTIVE',
        serverSeedHash: this.engine.hashServerSeed(serverSeed),
        clientSeed: null,
        roundCount: 0,
        totalWagered: '0',
        totalWon: '0',
      }),
    );

    return {
      sessionId: session.id,
      game: this.serializeGame(game),
      serverSeedHash: session.serverSeedHash,
    };
  }

  async play(
    userId: string,
    gameId: string,
    body: {
      sessionId: string;
      betAmount: number;
      idempotencyKey: string;
      clientSeed?: string;
    },
  ) {
    await this.rg.assertCanPlay(userId);

    const existingRound = await this.roundRepo.findOne({
      where: { idempotencyKey: body.idempotencyKey },
    });
    if (existingRound) {
      return {
        roundId: existingRound.id,
        betAmount: parseFloat(existingRound.betAmount),
        winAmount: parseFloat(existingRound.winAmount),
        result: existingRound.resultData,
        duplicate: true,
      };
    }

    const game = await this.gameRepo.findOne({ where: { id: gameId, status: 'ACTIVE' } });
    if (!game) throw new NotFoundException({ code: 'GAME_UNAVAILABLE', message: 'Game not found' });

    const session = await this.sessionRepo.findOne({
      where: { id: body.sessionId, userId, gameId, status: 'ACTIVE' },
    });
    if (!session) {
      throw new BadRequestException({ code: 'SESSION_INVALID', message: 'Invalid session' });
    }

    const minBet = parseFloat(game.minBet);
    const maxBet = parseFloat(game.maxBet);
    if (body.betAmount < minBet || body.betAmount > maxBet) {
      throw new BadRequestException({
        code: 'BET_LIMIT_EXCEEDED',
        message: `Bet must be between ${minBet} and ${maxBet}`,
      });
    }

    const { transaction: betTx } = await this.walletService.placeBet(
      userId,
      body.betAmount,
      body.idempotencyKey,
      { gameId, sessionId: session.id },
    );

    const serverSeed = this.engine.generateServerSeed();
    const clientSeed = body.clientSeed || randomUUID();
    const nonce = session.roundCount + 1;

    const outcome = this.engine.play(game.category, {
      serverSeed,
      clientSeed,
      nonce,
      betAmount: body.betAmount,
    });

    const winAmount = (outcome as { winAmount?: number }).winAmount || 0;
    let winTxId: string | null = null;
    if (winAmount > 0) {
      const win = await this.walletService.creditWin(
        userId,
        winAmount,
        `${body.idempotencyKey}-win`,
        { gameId, sessionId: session.id },
      );
      winTxId = win.transaction?.id ?? null;
    }

    const round = await this.roundRepo.save(
      this.roundRepo.create({
        sessionId: session.id,
        userId,
        gameId,
        roundNumber: nonce,
        betAmount: body.betAmount.toFixed(4),
        winAmount: winAmount.toFixed(4),
        resultHash: (outcome as { resultHash?: string }).resultHash ?? null,
        resultData: outcome as unknown as Record<string, unknown>,
        betTransactionId: betTx.id,
        winTransactionId: winTxId,
        idempotencyKey: body.idempotencyKey,
      }),
    );

    session.roundCount = nonce;
    session.totalWagered = (parseFloat(session.totalWagered) + body.betAmount).toFixed(4);
    session.totalWon = (parseFloat(session.totalWon) + winAmount).toFixed(4);
    await this.sessionRepo.save(session);

    game.playCount += 1;
    await this.gameRepo.save(game);

    await this.audit.log({
      userId,
      action: 'GAME_ROUND',
      entity: 'game_round',
      entityId: round.id,
      metadata: { gameId, bet: body.betAmount, win: winAmount },
    });

    const updatedWallet = await this.walletService.getWallet(userId);

    return {
      roundId: round.id,
      betAmount: body.betAmount,
      winAmount,
      result: outcome,
      balance: parseFloat(updatedWallet.availableBalance),
    };
  }

  private serializeGame(g: Game) {
    return {
      id: g.id,
      slug: g.slug,
      name: g.name,
      category: g.category,
      thumbnail: g.thumbnail,
      isNew: g.isNew,
      isPopular: g.isPopular,
      hasJackpot: g.hasJackpot,
      minBet: parseFloat(g.minBet),
      maxBet: parseFloat(g.maxBet),
      provider: g.provider ? { name: g.provider.name, slug: g.provider.slug } : null,
    };
  }
}
