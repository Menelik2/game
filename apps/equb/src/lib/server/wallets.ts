const STARTING = 100;

export type Wallet = {
  playerId: string;
  balance: number;
  updatedAt: number;
  version: number;
};

export type BalanceEvent = {
  id: string;
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
  __nextWalletLedger?: BalanceEvent[];
};
if (!g.__nextWallets) g.__nextWallets = new Map();
if (!g.__nextBalListeners) g.__nextBalListeners = new Map();
if (!g.__nextWalletLedger) g.__nextWalletLedger = [];

const wallets = g.__nextWallets;
const listeners = g.__nextBalListeners;
const ledger = g.__nextWalletLedger;

const MAX_LEDGER = 2000;

export function ensureWallet(playerId: string): Wallet {
  let w = wallets.get(playerId);
  if (!w) {
    w = { playerId, balance: STARTING, updatedAt: Date.now(), version: 1 };
    wallets.set(playerId, w);
  }
  return { ...w };
}

function pushLedger(ev: BalanceEvent) {
  ledger.unshift(ev);
  if (ledger.length > MAX_LEDGER) ledger.length = MAX_LEDGER;
}

function notify(ev: BalanceEvent) {
  pushLedger(ev);
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
    id: `we_${Date.now()}_${live.version}`,
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
    id: `we_${Date.now()}_${live.version}`,
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

/** Admin / history: recent balance movements (newest first). */
export function listWalletHistory(opts?: {
  playerId?: string;
  limit?: number;
}): BalanceEvent[] {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);
  let rows = ledger;
  if (opts?.playerId) {
    rows = ledger.filter((e) => e.playerId === opts.playerId);
  }
  return rows.slice(0, limit);
}
