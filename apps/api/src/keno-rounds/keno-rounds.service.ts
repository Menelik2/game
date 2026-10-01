import {
  Injectable,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { GameEngineService } from '../games/game-engine.service';

export type RoundStatus = 'open' | 'closed' | 'settled';

export type KenoRoundBet = {
  id: string;
  userId: string;
  playerName: string;
  picks: number[];
  betAmount: number;
  matchCount?: number;
  hits?: number[];
  winAmount?: number;
  placedAt: number;
};

export type KenoRound = {
  id: string;
  roundNumber: number;
  status: RoundStatus;
  openAt: number;
  closeAt: number;
  drawAt: number;
  drawn: number[] | null;
  resultHash: string | null;
  bets: KenoRoundBet[];
  totalStake: number;
  totalPayout: number;
};

const OPEN_MS = 25_000;
const SETTLE_GAP_MS = 5_000;

@Injectable()
export class KenoRoundsService implements OnModuleInit {
  private readonly log = new Logger(KenoRoundsService.name);
  private rounds = new Map<string, KenoRound>();
  private currentId: string | null = null;
  private roundSeq = 10000;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly engine: GameEngineService) {}

  onModuleInit() {
    this.ensureOpenRound();
    this.timer = setInterval(() => this.tick(), 1000);
    this.log.log('Keno round scheduler started (demo in-memory)');
  }

  private ensureOpenRound() {
    if (this.currentId) {
      const c = this.rounds.get(this.currentId);
      if (c && c.status === 'open') return c;
    }
    return this.createRound();
  }

  private createRound(): KenoRound {
    const now = Date.now();
    this.roundSeq += 1;
    const id = `kr-${this.roundSeq}`;
    const round: KenoRound = {
      id,
      roundNumber: this.roundSeq,
      status: 'open',
      openAt: now,
      closeAt: now + OPEN_MS,
      drawAt: now + OPEN_MS + 1000,
      drawn: null,
      resultHash: null,
      bets: [],
      totalStake: 0,
      totalPayout: 0,
    };
    this.rounds.set(id, round);
    this.currentId = id;
    if (this.rounds.size > 40) {
      const keys = [...this.rounds.keys()].slice(0, this.rounds.size - 30);
      for (const k of keys) this.rounds.delete(k);
    }
    return round;
  }

  private tick() {
    const now = Date.now();
    if (!this.currentId) {
      this.ensureOpenRound();
      return;
    }
    const r = this.rounds.get(this.currentId);
    if (!r) {
      this.ensureOpenRound();
      return;
    }
    if (r.status === 'open' && now >= r.closeAt) {
      r.status = 'closed';
      this.settleRound(r);
    }
    if (r.status === 'settled' && now >= r.drawAt + SETTLE_GAP_MS) {
      this.createRound();
    }
  }

  private settleRound(r: KenoRound) {
    const serverSeed = randomBytes(32).toString('hex');
    const clientSeed = `round-${r.roundNumber}`;
    const nonce = r.roundNumber;
    const outcome = this.engine.playKeno({
      serverSeed,
      clientSeed,
      nonce,
      betAmount: 1,
      picks: [1],
    });
    r.drawn = outcome.drawn;
    r.resultHash = createHash('sha256')
      .update(JSON.stringify({ round: r.roundNumber, drawn: r.drawn, serverSeed }))
      .digest('hex');

    let totalPayout = 0;
    for (const bet of r.bets) {
      const hitSet = new Set(r.drawn);
      const hits = bet.picks.filter((n) => hitSet.has(n));
      bet.hits = hits;
      bet.matchCount = hits.length;
      const spots = bet.picks.length;
      const table = this.paytable();
      const mult = table[spots]?.[hits.length] ?? 0;
      bet.winAmount = Math.round(bet.betAmount * mult * 100) / 100;
      totalPayout += bet.winAmount;
    }
    r.totalPayout = totalPayout;
    r.status = 'settled';
    this.log.log(`Round ${r.roundNumber} settled · ${r.bets.length} bets`);
  }

  private paytable(): Record<number, Record<number, number>> {
    return {
      1: { 1: 3 },
      2: { 2: 12 },
      3: { 2: 1.5, 3: 40 },
      4: { 2: 1, 3: 5, 4: 80 },
      5: { 3: 2, 4: 15, 5: 200 },
      6: { 3: 1, 4: 5, 5: 50, 6: 500 },
      7: { 4: 2, 5: 15, 6: 100, 7: 1000 },
      8: { 5: 5, 6: 40, 7: 200, 8: 2000 },
      9: { 5: 2, 6: 15, 7: 80, 8: 500, 9: 5000 },
      10: { 5: 1, 6: 5, 7: 25, 8: 150, 9: 1000, 10: 10000 },
    };
  }

  getCurrent() {
    return this.publicRound(this.ensureOpenRound());
  }

  getHistory(limit = 10) {
    return [...this.rounds.values()]
      .filter((x) => x.status === 'settled')
      .sort((a, b) => b.roundNumber - a.roundNumber)
      .slice(0, limit)
      .map((r) => this.publicRound(r));
  }

  getOne(id: string) {
    const r = this.rounds.get(id);
    if (!r) throw new BadRequestException('Round not found');
    return this.publicRound(r);
  }

  placeBet(params: {
    userId: string;
    playerName?: string;
    picks: number[];
    betAmount: number;
  }) {
    const r = this.ensureOpenRound();
    if (r.status !== 'open' || Date.now() >= r.closeAt) {
      throw new BadRequestException('Betting closed for this round');
    }
    const picks = [...new Set((params.picks || []).map((n) => Math.floor(Number(n))))]
      .filter((n) => n >= 1 && n <= 80)
      .sort((a, b) => a - b);
    if (picks.length < 1 || picks.length > 10) {
      throw new BadRequestException('Select 1–10 unique numbers (1–80)');
    }
    const betAmount = Number(params.betAmount);
    if (!Number.isFinite(betAmount) || betAmount < 0.2 || betAmount > 1000) {
      throw new BadRequestException('Invalid bet amount');
    }
    if (r.bets.some((b) => b.userId === params.userId)) {
      throw new BadRequestException('Already bet this round');
    }
    const bet: KenoRoundBet = {
      id: randomBytes(8).toString('hex'),
      userId: params.userId,
      playerName: params.playerName || 'Player',
      picks,
      betAmount,
      placedAt: Date.now(),
    };
    r.bets.push(bet);
    r.totalStake += betAmount;
    return {
      ok: true,
      round: this.publicRound(r),
      bet: { id: bet.id, picks: bet.picks, betAmount: bet.betAmount },
      message: `Bet locked for round #${r.roundNumber}`,
    };
  }

  private publicRound(r: KenoRound) {
    const now = Date.now();
    return {
      id: r.id,
      roundNumber: r.roundNumber,
      status: r.status,
      openAt: r.openAt,
      closeAt: r.closeAt,
      drawAt: r.drawAt,
      secondsLeft:
        r.status === 'open' ? Math.max(0, Math.ceil((r.closeAt - now) / 1000)) : 0,
      drawn: r.drawn,
      resultHash: r.resultHash,
      betCount: r.bets.length,
      totalStake: r.totalStake,
      totalPayout: r.totalPayout,
      bets: r.bets.map((b) => ({
        playerName: b.playerName,
        picks: b.picks,
        betAmount: b.betAmount,
        matchCount: b.matchCount,
        hits: b.hits,
        winAmount: b.winAmount,
        userId: b.userId.slice(0, 8),
      })),
    };
  }
}
