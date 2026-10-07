/**
 * Platform prize / profit settings.
 * Fee rate drives adminFee on every completed Equb draw.
 */

export type PrizeSettings = {
  /** Platform cut of each pot, 0–0.5 (e.g. 0.15 = 15%) */
  platformFeeRate: number;
  /** Human label */
  updatedAt: string;
  updatedBy?: string | null;
};

const DEFAULT_RATE = 0.15;

const g = globalThis as unknown as { __prizeSettings?: PrizeSettings };

function clampRate(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_RATE;
  return Math.min(0.5, Math.max(0, Math.round(n * 10000) / 10000));
}

export function getPrizeSettings(): PrizeSettings {
  if (!g.__prizeSettings) {
    const fromEnv = Number(process.env.PLATFORM_FEE_RATE);
    g.__prizeSettings = {
      platformFeeRate: clampRate(
        Number.isFinite(fromEnv) && fromEnv >= 0 ? fromEnv : DEFAULT_RATE,
      ),
      updatedAt: new Date().toISOString(),
      updatedBy: null,
    };
  }
  return { ...g.__prizeSettings };
}

export function setPrizeSettings(input: {
  platformFeeRate: number;
  updatedBy?: string | null;
}): PrizeSettings {
  const next: PrizeSettings = {
    platformFeeRate: clampRate(input.platformFeeRate),
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ?? null,
  };
  g.__prizeSettings = next;
  return { ...next };
}

export function getPlatformFeeRate(): number {
  return getPrizeSettings().platformFeeRate;
}

/** Split pot using current (or override) platform fee rate. */
export function splitPotWithRate(
  prizePool: number,
  rate?: number,
): {
  grossPot: number;
  adminFee: number;
  winnerPayout: number;
  adminFeeRate: number;
} {
  const feeRate = clampRate(rate ?? getPlatformFeeRate());
  const gross = Math.round(Number(prizePool) * 100) / 100;
  const adminFee = Math.round(gross * feeRate * 100) / 100;
  const winnerPayout = Math.round((gross - adminFee) * 100) / 100;
  return { grossPot: gross, adminFee, winnerPayout, adminFeeRate: feeRate };
}
