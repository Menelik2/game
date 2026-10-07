/**
 * In-memory sliding-window rate limiter (per serverless instance).
 * Protects login/register/deposit from brute-force and spam.
 */

type Bucket = { count: number; resetAt: number };

const g = globalThis as unknown as { __rl?: Map<string, Bucket> };
if (!g.__rl) g.__rl = new Map();

const store = g.__rl;

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  let b = store.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    store.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  // opportunistic cleanup
  if (store.size > 5000) {
    for (const [k, v] of store) {
      if (now >= v.resetAt) store.delete(k);
    }
  }
  return { ok: true, remaining: limit - b.count };
}

export function clientIp(req: Request): string {
  const h = (name: string) => req.headers.get(name) || '';
  const xf = h('x-forwarded-for').split(',')[0]?.trim();
  return (
    xf ||
    h('x-real-ip') ||
    h('cf-connecting-ip') ||
    h('x-vercel-forwarded-for').split(',')[0]?.trim() ||
    'unknown'
  );
}
