const STARTING = 100;

export type Wallet = {
  playerId: string;
  balance: number;
  updatedAt: number;
  version: number;
};

export type BalanceEvent = {
  playerId: string;
  balance: number;
  delta: number;
  reason: string;
  at: number;
  version: number;
};

const g = globalThis as unknown as {
  __nextWallets?: Map<string, Wallet>;
  __nextBalListeners?: Map<string, Set<(e: BalanceEvent) => void>>;
};
if (!g.__nextWallets) g.__nextWallets = new Map();
if (!g.__nextBalListeners) g.__nextBalListeners = new Map();

const wallets = g.__nextWallets;
const listeners = g.__nextBalListeners;

export function ensureWallet(playerId: string): Wallet {
  let w = wallets.get(playerId);
  if (!w) {
    w = { playerId, balance: STARTING, updatedAt: Date.now(), version: 1 };
    wallets.set(playerId, w);
  }
  return { ...w };
}

function notify(ev: BalanceEvent) {
  const set = listeners.get(ev.playerId);
  if (!set) return;
  for (const fn of set) {
    try {
      fn(ev);
    } catch {
      /* */
    }
  }
}

export function applyDelta(
  playerId: string,
  delta: number,
  reason: string,
): Wallet {
  let live = wallets.get(playerId);
  if (!live) {
    live = { playerId, balance: STARTING, updatedAt: Date.now(), version: 1 };
    wallets.set(playerId, live);
  }
  const next = Math.max(0, Math.round((live.balance + delta) * 100) / 100);
  live.balance = next;
  live.updatedAt = Date.now();
  live.version += 1;
  notify({
    playerId,
    balance: next,
    delta,
    reason,
    at: live.updatedAt,
    version: live.version,
  });
  return { ...live };
}

export function setBalance(playerId: string, balance: number): Wallet {
  let live = wallets.get(playerId);
  if (!live) {
    live = { playerId, balance: STARTING, updatedAt: Date.now(), version: 1 };
    wallets.set(playerId, live);
  }
  const next = Math.max(0, Math.round(balance * 100) / 100);
  const delta = next - live.balance;
  live.balance = next;
  live.updatedAt = Date.now();
  live.version += 1;
  notify({
    playerId,
    balance: next,
    delta,
    reason: 'set',
    at: live.updatedAt,
    version: live.version,
  });
  return { ...live };
}

export function subscribe(
  playerId: string,
  fn: (e: BalanceEvent) => void,
): () => void {
  let set = listeners.get(playerId);
  if (!set) {
    set = new Set();
    listeners.set(playerId, set);
  }
  set.add(fn);
  return () => set!.delete(fn);
}
