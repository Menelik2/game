import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, createHash, createHmac } from 'crypto';

@Injectable()
export class GameEngineService {
  private readonly logger = new Logger(GameEngineService.name);

  generateServerSeed(): string {
    return randomBytes(32).toString('hex');
  }

  hashServerSeed(seed: string): string {
    return createHash('sha256').update(seed).digest('hex');
  }

  private deriveFloat(serverSeed: string, clientSeed: string, nonce: number, cursor = 0): number {
    const hmac = createHmac('sha256', serverSeed);
    hmac.update(`${clientSeed}:${nonce}:${cursor}`);
    const hex = hmac.digest('hex').slice(0, 8);
    return parseInt(hex, 16) / 0xffffffff;
  }

  spinSlot(params: {
    serverSeed: string;
    clientSeed: string;
    nonce: number;
    betAmount: number;
    config?: { reels?: number; rows?: number; symbols?: string[] };
  }): {
    reels: string[][];
    symbols: string[];
    winAmount: number;
    multiplier: number;
    resultHash: string;
  } {
    const { serverSeed, clientSeed, nonce, betAmount, config = {} } = params;
    const reelCount = config.reels ?? 5;
    const rowCount = config.rows ?? 3;
    const symbols = config.symbols ?? ['A', 'K', 'Q', 'J', '10', '9', 'WILD', 'SCATTER'];
    const paytable: Record<string, number[]> = {
      A: [0, 0, 5, 20, 50],
      K: [0, 0, 4, 15, 40],
      Q: [0, 0, 3, 10, 25],
      J: [0, 0, 2, 8, 20],
      '10': [0, 0, 2, 6, 15],
      '9': [0, 0, 1, 4, 10],
      WILD: [0, 0, 10, 50, 200],
      SCATTER: [0, 0, 2, 10, 50],
    };

    const reels: string[][] = [];
    for (let r = 0; r < reelCount; r++) {
      const column: string[] = [];
      for (let row = 0; row < rowCount; row++) {
        const f = this.deriveFloat(serverSeed, clientSeed, nonce, r * rowCount + row);
        column.push(symbols[Math.floor(f * symbols.length)]);
      }
      reels.push(column);
    }

    const middleLine = reels.map((col) => col[1]);
    let consecutive = 1;
    const first = middleLine[0];
    for (let i = 1; i < middleLine.length; i++) {
      if (middleLine[i] === first || middleLine[i] === 'WILD' || first === 'WILD') consecutive++;
      else break;
    }
    const symbolKey = first === 'WILD' ? 'WILD' : first;
    const lineMultiplier = (paytable[symbolKey] || [0, 0, 0, 0, 0])[Math.min(consecutive - 1, 4)] || 0;
    const winAmount = Math.round(betAmount * lineMultiplier * 100) / 100;
    const resultHash = createHash('sha256')
      .update(JSON.stringify({ reels, winAmount, nonce }))
      .digest('hex');

    return { reels, symbols: middleLine, winAmount, multiplier: lineMultiplier, resultHash };
  }

  spinRoulette(params: {
    serverSeed: string;
    clientSeed: string;
    nonce: number;
    bets: { type: string; value?: number | string; amount: number }[];
  }): {
    number: number;
    color: 'red' | 'black' | 'green';
    totalWin: number;
    resultHash: string;
  } {
    const { serverSeed, clientSeed, nonce, bets } = params;
    const f = this.deriveFloat(serverSeed, clientSeed, nonce);
    const number = Math.floor(f * 37);
    const reds = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    const color: 'red' | 'black' | 'green' =
      number === 0 ? 'green' : reds.has(number) ? 'red' : 'black';

    let totalWin = 0;
    for (const bet of bets) {
      let payout = 0;
      if (bet.type === 'red' && color === 'red') payout = bet.amount * 2;
      else if (bet.type === 'black' && color === 'black') payout = bet.amount * 2;
      else if (bet.type === 'number' && Number(bet.value) === number) payout = bet.amount * 36;
      else if (bet.type === 'even' && number > 0 && number % 2 === 0) payout = bet.amount * 2;
      else if (bet.type === 'odd' && number % 2 === 1) payout = bet.amount * 2;
      totalWin += payout;
    }

    const resultHash = createHash('sha256')
      .update(JSON.stringify({ number, color, totalWin, nonce }))
      .digest('hex');
    return { number, color, totalWin, resultHash };
  }

  generateCrashPoint(params: {
    serverSeed: string;
    clientSeed: string;
    nonce: number;
  }): { crashPoint: number; resultHash: string } {
    const f = Math.max(this.deriveFloat(params.serverSeed, params.clientSeed, params.nonce), 1e-9);
    let crashPoint = Math.floor((1 / f) * 100) / 100;
    if (crashPoint > 1000) crashPoint = 1000;
    if (crashPoint < 1.01) crashPoint = 1.01;
    const resultHash = createHash('sha256')
      .update(JSON.stringify({ crashPoint, nonce: params.nonce }))
      .digest('hex');
    return { crashPoint, resultHash };
  }

  private buildShuffledDeck(serverSeed: string, clientSeed: string, nonce: number): string[] {
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['H', 'D', 'C', 'S'];
    const deck: string[] = [];
    for (const s of suits) for (const r of ranks) deck.push(`${r}${s}`);
    for (let i = deck.length - 1; i > 0; i--) {
      const f = this.deriveFloat(serverSeed, clientSeed, nonce, i);
      const j = Math.floor(f * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  private handValue(cards: string[]): number {
    let total = 0;
    let aces = 0;
    for (const c of cards) {
      const rank = c.slice(0, -1);
      if (rank === 'A') {
        total += 11;
        aces++;
      } else if (['K', 'Q', 'J'].includes(rank)) total += 10;
      else total += parseInt(rank, 10);
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }

  playBlackjack(params: {
    serverSeed: string;
    clientSeed: string;
    nonce: number;
    betAmount: number;
    action?: 'hit' | 'stand';
  }): {
    playerCards: string[];
    dealerCards: string[];
    playerTotal: number;
    dealerTotal: number;
    outcome: string;
    winAmount: number;
    resultHash: string;
  } {
    const deck = this.buildShuffledDeck(params.serverSeed, params.clientSeed, params.nonce);
    let idx = 0;
    const draw = () => deck[idx++];
    const playerCards = [draw(), draw()];
    const dealerCards = [draw(), draw()];

    if (params.action === 'hit') playerCards.push(draw());
    while (this.handValue(dealerCards) < 17) dealerCards.push(draw());

    const player = this.handValue(playerCards);
    const dealer = this.handValue(dealerCards);
    let outcome = 'lose';
    let winAmount = 0;
    if (player > 21) outcome = 'bust';
    else if (playerCards.length === 2 && player === 21) {
      outcome = 'blackjack';
      winAmount = Math.round(params.betAmount * 2.5 * 100) / 100;
    } else if (dealer > 21 || player > dealer) {
      outcome = 'win';
      winAmount = params.betAmount * 2;
    } else if (player === dealer) {
      outcome = 'push';
      winAmount = params.betAmount;
    }

    const resultHash = createHash('sha256')
      .update(JSON.stringify({ playerCards, dealerCards, outcome, nonce: params.nonce }))
      .digest('hex');

    return {
      playerCards,
      dealerCards,
      playerTotal: player,
      dealerTotal: dealer,
      outcome,
      winAmount,
      resultHash,
    };
  }

  playBaccarat(params: {
    serverSeed: string;
    clientSeed: string;
    nonce: number;
    betAmount: number;
    betOn: 'player' | 'banker' | 'tie';
  }): {
    playerCards: string[];
    bankerCards: string[];
    playerTotal: number;
    bankerTotal: number;
    winner: 'player' | 'banker' | 'tie';
    winAmount: number;
    resultHash: string;
  } {
    const deck = this.buildShuffledDeck(params.serverSeed, params.clientSeed, params.nonce);
    let idx = 0;
    const draw = () => deck[idx++];
    const val = (card: string) => {
      const r = card.slice(0, -1);
      if (['10', 'J', 'Q', 'K'].includes(r)) return 0;
      if (r === 'A') return 1;
      return parseInt(r, 10);
    };
    const total = (cards: string[]) => cards.reduce((s, c) => s + val(c), 0) % 10;

    const playerCards = [draw(), draw()];
    const bankerCards = [draw(), draw()];
    let p = total(playerCards);
    let b = total(bankerCards);

    if (p < 8 && b < 8) {
      let playerThird: string | null = null;
      if (p <= 5) {
        playerThird = draw();
        playerCards.push(playerThird);
        p = total(playerCards);
      }
      if (playerThird === null) {
        if (b <= 5) {
          bankerCards.push(draw());
          b = total(bankerCards);
        }
      } else {
        const pt = val(playerThird);
        const bankerDraws =
          b <= 2 ||
          (b === 3 && pt !== 8) ||
          (b === 4 && pt >= 2 && pt <= 7) ||
          (b === 5 && pt >= 4 && pt <= 7) ||
          (b === 6 && (pt === 6 || pt === 7));
        if (bankerDraws) {
          bankerCards.push(draw());
          b = total(bankerCards);
        }
      }
    }

    let winner: 'player' | 'banker' | 'tie' = 'tie';
    if (p > b) winner = 'player';
    else if (b > p) winner = 'banker';

    let winAmount = 0;
    if (params.betOn === winner) {
      if (winner === 'tie') winAmount = params.betAmount * 9;
      else if (winner === 'banker') winAmount = Math.round(params.betAmount * 1.95 * 100) / 100;
      else winAmount = params.betAmount * 2;
    }

    const resultHash = createHash('sha256')
      .update(JSON.stringify({ playerCards, bankerCards, winner, nonce: params.nonce }))
      .digest('hex');

    return {
      playerCards,
      bankerCards,
      playerTotal: p,
      bankerTotal: b,
      winner,
      winAmount,
      resultHash,
    };
  }
}
