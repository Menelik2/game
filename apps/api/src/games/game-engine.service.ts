import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, createHash, createHmac } from 'crypto';

/**
 * Server-authoritative game engine.
 * Uses Node.js crypto — never Math.random() for outcomes.
 */
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
  }): { reels: string[][]; winAmount: number; multiplier: number; resultHash: string } {
    const symbols = ['A', 'K', 'Q', 'J', '10', '9', 'WILD', 'SCATTER'];
    const reels: string[][] = [];
    for (let r = 0; r < 5; r++) {
      const col: string[] = [];
      for (let row = 0; row < 3; row++) {
        const f = this.deriveFloat(params.serverSeed, params.clientSeed, params.nonce, r * 3 + row);
        col.push(symbols[Math.floor(f * symbols.length)]);
      }
      reels.push(col);
    }
    // Simple middle-row match payout
    const mid = reels.map((c) => c[1]);
    let multiplier = 0;
    if (mid.every((s) => s === mid[0] || s === 'WILD')) multiplier = 10;
    else if (mid[0] === mid[1] && mid[1] === mid[2]) multiplier = 3;
    else if (mid[0] === mid[1]) multiplier = 1.2;

    const winAmount = Math.round(params.betAmount * multiplier * 100) / 100;
    const resultHash = createHash('sha256')
      .update(JSON.stringify({ reels, winAmount, nonce: params.nonce }))
      .digest('hex');

    return { reels, winAmount, multiplier, resultHash };
  }

  spinRoulette(params: {
    serverSeed: string;
    clientSeed: string;
    nonce: number;
    betAmount: number;
    betType?: string;
    betValue?: string | number;
  }): { number: number; color: string; winAmount: number; resultHash: string } {
    const f = this.deriveFloat(params.serverSeed, params.clientSeed, params.nonce);
    const number = Math.floor(f * 37); // 0-36 European
    const reds = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
    const color = number === 0 ? 'green' : reds.has(number) ? 'red' : 'black';

    let winAmount = 0;
    const betType = params.betType || 'color';
    if (betType === 'color' && params.betValue === color && color !== 'green') {
      winAmount = params.betAmount * 2;
    } else if (betType === 'number' && Number(params.betValue) === number) {
      winAmount = params.betAmount * 36;
    }

    const resultHash = createHash('sha256')
      .update(`${number}:${color}:${params.nonce}`)
      .digest('hex');

    return { number, color, winAmount, resultHash };
  }

  playCrash(params: {
    serverSeed: string;
    clientSeed: string;
    nonce: number;
    betAmount: number;
    cashoutAt?: number;
  }): { crashPoint: number; cashedOut: boolean; winAmount: number; resultHash: string } {
    const f = this.deriveFloat(params.serverSeed, params.clientSeed, params.nonce);
    // House-edge crash curve (illustrative)
    const crashPoint = Math.max(1, Math.floor((0.99 / (1 - f)) * 100) / 100);
    const cashoutAt = params.cashoutAt ?? 1.5;
    const cashedOut = cashoutAt < crashPoint;
    const winAmount = cashedOut ? Math.round(params.betAmount * cashoutAt * 100) / 100 : 0;
    const resultHash = createHash('sha256')
      .update(`${crashPoint}:${params.nonce}`)
      .digest('hex');
    return { crashPoint, cashedOut, winAmount, resultHash };
  }

  /** Dispatch by game category */
  play(category: string, params: {
    serverSeed: string;
    clientSeed: string;
    nonce: number;
    betAmount: number;
    [key: string]: unknown;
  }) {
    switch (category) {
      case 'ROULETTE':
        return { type: 'roulette', ...this.spinRoulette(params as any) };
      case 'CRASH':
      case 'INSTANT':
        return { type: 'crash', ...this.playCrash(params as any) };
      default:
        return { type: 'slots', ...this.spinSlot(params as any) };
    }
  }
}
