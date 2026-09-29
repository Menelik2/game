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
    return parseInt(hex, 16) / 0x100000000;
  }

  private evaluatePayline(line: string[]): { consecutive: number; paySymbol: string } {
    if (!line.length) return { consecutive: 0, paySymbol: '9' };
    let paySymbol = line[0] === 'WILD' ? 'WILD' : line[0];
    let consecutive = 1;
    for (let i = 1; i < line.length; i++) {
      const s = line[i];
      if (s === 'WILD') { consecutive++; continue; }
      if (paySymbol === 'WILD') { paySymbol = s; consecutive++; continue; }
      if (s === paySymbol) { consecutive++; continue; }
      break;
    }
    return { consecutive, paySymbol };
  }

  spinSlot(params: {
    serverSeed: string; clientSeed: string; nonce: number; betAmount: number;
    config?: { reels?: number; rows?: number; symbols?: string[]; paytable?: Record<string, number[]> };
  }) {
    const { serverSeed, clientSeed, nonce, betAmount, config = {} } = params;
    const reelCount = config.reels ?? 5;
    const rowCount = config.rows ?? 3;
    const symbols = config.symbols ?? ['A', 'K', 'Q', 'J', '10', '9', 'WILD', 'SCATTER'];
    const paytable = config.paytable ?? {
      A: [0, 0, 5, 20, 50], K: [0, 0, 4, 15, 40], Q: [0, 0, 3, 10, 25],
      J: [0, 0, 2, 8, 20], '10': [0, 0, 2, 6, 15], '9': [0, 0, 1, 4, 10],
      WILD: [0, 0, 10, 50, 200], SCATTER: [0, 0, 2, 10, 50],
    };
    const reels: string[][] = [];
    for (let r = 0; r < reelCount; r++) {
      const column: string[] = [];
      for (let row = 0; row < rowCount; row++) {
        const f = this.deriveFloat(serverSeed, clientSeed, nonce, r * rowCount + row);
        column.push(symbols[Math.min(Math.floor(f * symbols.length), symbols.length - 1)]);
      }
      reels.push(column);
    }
    const middleLine = reels.map((col) => col[Math.min(1, rowCount - 1)]);
    const { consecutive, paySymbol } = this.evaluatePayline(middleLine);
    const multipliers = paytable[paySymbol] || [0, 0, 0, 0, 0];
    const lineMultiplier = multipliers[Math.min(consecutive - 1, multipliers.length - 1)] || 0;
    const winAmount = Math.round(betAmount * lineMultiplier * 100) / 100;
    const resultHash = createHash('sha256').update(JSON.stringify({ reels, winAmount, nonce })).digest('hex');
    return {
      reels, symbols: middleLine, winAmount, multiplier: lineMultiplier,
      lines: lineMultiplier > 0 ? [{ line: 1, symbols: middleLine, payout: winAmount }] : [],
      resultHash,
    };
  }

  spinRoulette(params: {
    serverSeed: string; clientSeed: string; nonce: number;
    bets: { type: string; value?: number | string; amount: number }[];
  }) {
    const { serverSeed, clientSeed, nonce, bets } = params;
    const number = Math.floor(this.deriveFloat(serverSeed, clientSeed, nonce, 0) * 37);
    const reds = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    const color: 'red' | 'black' | 'green' = number === 0 ? 'green' : reds.has(number) ? 'red' : 'black';
    const wins: { bet: unknown; payout: number }[] = [];
    let totalWin = 0;
    for (const bet of bets) {
      if (!bet.amount || bet.amount <= 0) continue;
      let payout = 0;
      const t = bet.type.toLowerCase();
      if ((t === 'straight' || t === 'number') && Number(bet.value) === number) payout = bet.amount * 36;
      else if (t === 'red' && color === 'red') payout = bet.amount * 2;
      else if (t === 'black' && color === 'black') payout = bet.amount * 2;
      else if (t === 'even' && number > 0 && number % 2 === 0) payout = bet.amount * 2;
      else if (t === 'odd' && number > 0 && number % 2 === 1) payout = bet.amount * 2;
      else if (t === 'high' && number >= 19 && number <= 36) payout = bet.amount * 2;
      else if (t === 'low' && number >= 1 && number <= 18) payout = bet.amount * 2;
      else if (t === 'dozen' && bet.value != null) {
        const d = Number(bet.value);
        if (d === 1 && number >= 1 && number <= 12) payout = bet.amount * 3;
        if (d === 2 && number >= 13 && number <= 24) payout = bet.amount * 3;
        if (d === 3 && number >= 25 && number <= 36) payout = bet.amount * 3;
      }
      if (payout > 0) { wins.push({ bet, payout }); totalWin += payout; }
    }
    totalWin = Math.round(totalWin * 100) / 100;
    const resultHash = createHash('sha256').update(JSON.stringify({ number, color, totalWin, nonce })).digest('hex');
    return { number, color, wins, totalWin, resultHash };
  }

  generateCrashPoint(params: { serverSeed: string; clientSeed: string; nonce: number }) {
    const f = this.deriveFloat(params.serverSeed, params.clientSeed, params.nonce, 0);
    const e = 0.01;
    let crashPoint: number;
    if (f < e) crashPoint = 1.0;
    else {
      crashPoint = Math.floor((100 * (1 - e)) / (1 - f)) / 100;
      if (crashPoint < 1.01) crashPoint = 1.01;
      if (crashPoint > 1000) crashPoint = 1000;
    }
    const resultHash = createHash('sha256').update(JSON.stringify({ crashPoint, nonce: params.nonce })).digest('hex');
    return { crashPoint, resultHash };
  }

  private buildShuffledDeck(serverSeed: string, clientSeed: string, nonce: number): string[] {
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['H', 'D', 'C', 'S'];
    const deck: string[] = [];
    for (const s of suits) for (const r of ranks) deck.push(`${r}${s}`);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(this.deriveFloat(serverSeed, clientSeed, nonce, i) * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  private handValue(cards: string[]): number {
    let total = 0, aces = 0;
    for (const c of cards) {
      const rank = c.slice(0, -1);
      if (rank === 'A') { total += 11; aces++; }
      else if (['K', 'Q', 'J'].includes(rank)) total += 10;
      else total += parseInt(rank, 10) || 0;
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  playBlackjack(params: {
    serverSeed: string; clientSeed: string; nonce: number; betAmount: number;
    action?: 'hit' | 'stand' | 'auto';
  }) {
    const deck = this.buildShuffledDeck(params.serverSeed, params.clientSeed, params.nonce);
    let idx = 0;
    const draw = () => deck[idx++];
    const playerCards = [draw(), draw()];
    const dealerCards = [draw(), draw()];
    const action = params.action || 'auto';
    if (action === 'hit') playerCards.push(draw());
    else if (action === 'auto') {
      while (this.handValue(playerCards) < 17 && this.handValue(playerCards) <= 21) {
        playerCards.push(draw());
        if (playerCards.length >= 5) break;
      }
    }
    while (this.handValue(dealerCards) < 17) {
      dealerCards.push(draw());
      if (dealerCards.length >= 7) break;
    }
    const player = this.handValue(playerCards);
    const dealer = this.handValue(dealerCards);
    const bet = params.betAmount;
    const playerNatural = playerCards.length === 2 && player === 21;
    const dealerNatural = dealerCards.length === 2 && dealer === 21;
    let outcome: 'blackjack' | 'win' | 'push' | 'lose' | 'bust' = 'lose';
    let winAmount = 0;
    if (player > 21) { outcome = 'bust'; winAmount = 0; }
    else if (playerNatural && !dealerNatural) { outcome = 'blackjack'; winAmount = Math.round(bet * 2.5 * 100) / 100; }
    else if (playerNatural && dealerNatural) { outcome = 'push'; winAmount = bet; }
    else if (dealer > 21 || player > dealer) { outcome = 'win'; winAmount = Math.round(bet * 2 * 100) / 100; }
    else if (player === dealer) { outcome = 'push'; winAmount = bet; }
    else { outcome = 'lose'; winAmount = 0; }
    const resultHash = createHash('sha256').update(JSON.stringify({ playerCards, dealerCards, outcome, nonce: params.nonce })).digest('hex');
    return { playerCards, dealerCards, playerTotal: player, dealerTotal: dealer, outcome, winAmount, resultHash };
  }

  playBaccarat(params: {
    serverSeed: string; clientSeed: string; nonce: number; betAmount: number;
    betOn: 'player' | 'banker' | 'tie';
  }) {
    const deck = this.buildShuffledDeck(params.serverSeed, params.clientSeed, params.nonce);
    let idx = 0;
    const draw = () => deck[idx++];
    const val = (card: string) => {
      const r = card.slice(0, -1);
      if (['10', 'J', 'Q', 'K'].includes(r)) return 0;
      if (r === 'A') return 1;
      return parseInt(r, 10) || 0;
    };
    const total = (cards: string[]) => cards.reduce((s, c) => s + val(c), 0) % 10;
    const playerCards = [draw(), draw()];
    const bankerCards = [draw(), draw()];
    let p = total(playerCards);
    let b = total(bankerCards);
    if (p < 8 && b < 8) {
      let playerThird: string | null = null;
      if (p <= 5) { playerThird = draw(); playerCards.push(playerThird); p = total(playerCards); }
      if (playerThird === null) {
        if (b <= 5) { bankerCards.push(draw()); b = total(bankerCards); }
      } else {
        const pt = val(playerThird);
        const bankerDraws =
          b <= 2 || (b === 3 && pt !== 8) || (b === 4 && pt >= 2 && pt <= 7) ||
          (b === 5 && pt >= 4 && pt <= 7) || (b === 6 && (pt === 6 || pt === 7));
        if (bankerDraws) { bankerCards.push(draw()); b = total(bankerCards); }
      }
    }
    let winner: 'player' | 'banker' | 'tie' = 'tie';
    if (p > b) winner = 'player';
    else if (b > p) winner = 'banker';
    const bet = params.betAmount;
    let winAmount = 0;
    if (params.betOn === winner) {
      if (winner === 'tie') winAmount = bet * 9;
      else if (winner === 'banker') winAmount = Math.round(bet * 1.95 * 100) / 100;
      else winAmount = bet * 2;
    }
    const resultHash = createHash('sha256').update(JSON.stringify({ playerCards, bankerCards, winner, nonce: params.nonce })).digest('hex');
    return { playerCards, bankerCards, playerTotal: p, bankerTotal: b, winner, winAmount, resultHash };
  }
}
