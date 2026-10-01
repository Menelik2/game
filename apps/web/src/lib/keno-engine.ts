/**
 * Fast Keno shared rules (aligned with API GameEngineService.playKeno).
 */

export const KENO_POOL_SIZE = 80;
export const KENO_DRAW_COUNT = 20;
export const KENO_MAX_SPOTS = 10;

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

export function cryptoShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function potentialWin(spots: number, hits: number, bet: number): number {
  const mult = KENO_PAYTABLE[spots]?.[hits] ?? 0;
  return Math.round(bet * mult * 100) / 100;
}

export function localKenoPlay(picks: number[], betAmount: number) {
  const raw = [...new Set(picks.map((n) => Math.floor(Number(n))))]
    .filter((n) => n >= 1 && n <= 80)
    .sort((a, b) => a - b);
  const pool = cryptoShuffle(Array.from({ length: 80 }, (_, i) => i + 1));
  const drawn = pool.slice(0, 20).sort((a, b) => a - b);
  const hitSet = new Set(drawn);
  const hits = raw.filter((n) => hitSet.has(n));
  const hitCount = hits.length;
  const winAmount = potentialWin(raw.length, hitCount, betAmount);
  return { picks: raw, drawn, hits, hitCount, winAmount, multiplier: KENO_PAYTABLE[raw.length]?.[hitCount] ?? 0 };
}
