/**
 * Cryptographic RNG for Fast Equb draws.
 * Demo runs in the browser; production multiplayer should use the same logic on the server.
 */

export type DrawProof = {
  winningNumber: number;
  entropyHex: string;
  commitmentHash: string;
  groupSize: number;
  drawnAt: number;
};

/** Uniform integer in [0, maxExclusive) via rejection sampling (no modulo bias). */
export function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0 || !Number.isInteger(maxExclusive)) {
    throw new Error('maxExclusive must be a positive integer');
  }
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Web Crypto API unavailable');
  }
  const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    const x = buf[0];
    if (x < limit) return x % maxExclusive;
  }
}

export function randomBytesHex(byteLength = 32): string {
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Web Crypto API unavailable');
  }
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Draw uniform 1..groupSize with CSPRNG + audit proof. */
export async function cryptographicDraw(groupSize: number): Promise<DrawProof> {
  if (groupSize < 2) throw new Error('groupSize must be >= 2');
  const entropyHex = randomBytesHex(32);
  const index = secureRandomInt(groupSize);
  const winningNumber = index + 1;
  const commitmentHash = await sha256Hex(`${entropyHex}:${groupSize}:${winningNumber}`);
  return {
    winningNumber,
    entropyHex,
    commitmentHash,
    groupSize,
    drawnAt: Date.now(),
  };
}

export async function verifyDrawProof(proof: DrawProof): Promise<boolean> {
  if (proof.winningNumber < 1 || proof.winningNumber > proof.groupSize) return false;
  const expected = await sha256Hex(
    `${proof.entropyHex}:${proof.groupSize}:${proof.winningNumber}`,
  );
  return expected === proof.commitmentHash;
}
