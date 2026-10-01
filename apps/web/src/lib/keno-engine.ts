/**
 * Fast Keno shared rules (must stay aligned with API GameEngineService.playKeno).
 * Offline demo uses Web Crypto; live play uses server HMAC draw only.
 */

export const KENO_POOL_SIZE = 80;
export const KENO_DRAW_COUNT = 20;
export const KENO_MAX_SPOTS = 10;

/** Multipliers of stake by spots selected → hit count */
export const KENO_PAYTABLE: Record<number, Record<number, number>> = {
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

function cryptoInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return x % maxExclusive;
}

/** Fisher–Yates with rejection sampling (CSPRNG). */
export function cryptoShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function validateKenoPicks(picks: number[]): number[] {
  const raw = [...new Set(picks.map((n) => Math.floor(Number(n))))]
    .filter((n) => n >= 1 && n <= KENO_POOL_SIZE)
    .sort((a, b) => a - b);
  if (raw.length < 1 || raw.length > KENO_MAX_SPOTS) {
    throw new Error(`Select 1–${KENO_MAX_SPOTS} unique numbers from 1–${KENO_POOL_SIZE}`);
  }
  return raw;
}

export type KenoResult = {
  picks: number[];
  drawn: number[];
  hits: number[];
  hitCount: number;
  spots: number;
  winAmount: number;
  multiplier: number;
  mode: 'demo' | 'server';
};

/** Offline / demo only — never use for real-money settlement. */
export function localKenoPlay(picks: number[], betAmount: number): KenoResult {
  const validated = validateKenoPicks(picks);
  if (!(betAmount > 0)) throw new Error('Invalid bet amount');

  const pool = cryptoShuffle(
    Array.from({ length: KENO_POOL_SIZE }, (_, i) => i + 1),
  );
  const drawn = pool.slice(0, KENO_DRAW_COUNT).sort((a, b) => a - b);
  const hitSet = new Set(drawn);
  const hits = validated.filter((n) => hitSet.has(n));
  const hitCount = hits.length;
  const spots = validated.length;
  const multiplier = KENO_PAYTABLE[spots]?.[hitCount] ?? 0;
  const winAmount = Math.round(betAmount * multiplier * 100) / 100;

  return {
    picks: validated,
    drawn,
    hits,
    hitCount,
    spots,
    winAmount,
    multiplier,
    mode: 'demo',
  };
}

export function potentialWin(spots: number, hitCount: number, bet: number): number {
  const m = KENO_PAYTABLE[spots]?.[hitCount] ?? 0;
  return Math.round(bet * m * 100) / 100;
}
