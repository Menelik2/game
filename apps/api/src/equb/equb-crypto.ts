import { randomBytes, createHash } from 'crypto';

export type DrawProof = {
  winningNumber: number;
  entropyHex: string;
  commitmentHash: string;
  groupSize: number;
  drawnAt: number;
};

/** Uniform int in [0, maxExclusive) via rejection sampling */
export function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) throw new Error('invalid range');
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  for (;;) {
    const x = randomBytes(4).readUInt32BE(0);
    if (x < limit) return x % maxExclusive;
  }
}

export function cryptographicDraw(groupSize: number): DrawProof {
  if (groupSize < 2) throw new Error('groupSize must be >= 2');
  const entropy = randomBytes(32);
  const entropyHex = entropy.toString('hex');
  const index = secureRandomInt(groupSize);
  const winningNumber = index + 1;
  const commitmentHash = createHash('sha256')
    .update(`${entropyHex}:${groupSize}:${winningNumber}`)
    .digest('hex');
  return {
    winningNumber,
    entropyHex,
    commitmentHash,
    groupSize,
    drawnAt: Date.now(),
  };
}
