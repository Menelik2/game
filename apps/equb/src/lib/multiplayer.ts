/**
 * Multiplayer client — prefers same-origin /api (Vercel) then NEXT_PUBLIC_API_URL.
 */

function resolveApiBase(): string {
  const env = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  if (typeof window === 'undefined') return env;
  if (!env) return '';
  try {
    const u = new URL(env);
    if (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return '';
    }
  } catch {
    return '';
  }
  return env;
}

export function getApiBase(): string {
  return resolveApiBase();
}

export function isMultiplayerEnabled(): boolean {
  return true;
}

export type ServerRoom = {
  id: string;
  templateId?: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier?: string;
  status: 'open' | 'drawing' | 'completed';
  members: Array<{
    playerId: string;
    name: string;
    pick: number;
    picks?: number[];
    joinedAt: number;
  }>;
  winningNumber: number | null;
  winnerId: string | null;
  winnerName?: string | null;
  adminFee?: number | null;
  winnerPayout?: number | null;
  entropyHex?: string | null;
  commitmentHash?: string | null;
  drawAt?: number;
  secondsLeft?: number;
  updatedAt?: number;
};

export type LiveTemplate = {
  id: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier?: string;
  liveRoomId: string | null;
  seatsTaken: number;
  status: string;
  secondsLeft?: number;
};

function anonymousPid() {
  if (typeof window === 'undefined') return 'ssr';
  let id = localStorage.getItem('equb_player_id');
  if (!id) {
    id = `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem('equb_player_id', id);
  }
  return id;
}

export function getPlayerIdentity(): { playerId: string; name: string } {
  if (typeof window === 'undefined') {
    return { playerId: 'ssr', name: 'Player' };
  }
  try {
    const snap = localStorage.getItem('equb_session_user_v1');
    if (snap) {
      const u = JSON.parse(snap);
      if (u?.id) {
        return {
          playerId: String(u.id),
          name: String(u.name || u.phone || 'Player').slice(0, 40),
        };
      }
    }
  } catch {
    /* ignore */
  }
  for (const key of ['fast-equb-v8', 'fast-equb-v7']) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const user = JSON.parse(raw)?.state?.user;
      if (user?.id) {
        return {
          playerId: String(user.id),
          name: String(user.name || user.phone || 'Player').slice(0, 40),
        };
      }
    } catch {
      /* next */
    }
  }
  const playerId = anonymousPid();
  const name = localStorage.getItem('equb_player_name') || 'Player';
  return { playerId, name: name.slice(0, 40) };
}

export function setPlayerName(name: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('equb_player_name', name.slice(0, 40));
  }
}

function apiUrl(path: string): string {
  const override =
    typeof window !== 'undefined' ? (window as any).__equbApiBase : undefined;
  const base =
    override !== undefined && override !== null
      ? String(override)
      : resolveApiBase();
  return `${base}/api${path}`;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(apiUrl(path), {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
      cache: 'no-store',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (Array.isArray(json?.message) ? json.message.join(', ') : json?.message) ||
        json?.error?.message ||
        `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return (json?.data !== undefined ? json.data : json) as T;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error('API timeout');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function probeApi(): Promise<boolean> {
  const bases: string[] = [''];
  const env = resolveApiBase();
  if (env) bases.push(env);
  for (const base of bases) {
    for (const path of ['/api/health', '/api/equb/ping', '/api/equb/templates']) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4_000);
        const res = await fetch(`${base}${path}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        });
        clearTimeout(timer);
        if (res.ok) {
          if (typeof window !== 'undefined') (window as any).__equbApiBase = base;
          return true;
        }
      } catch {
        /* next */
      }
    }
  }
  return false;
}

export function listTemplates() {
  return req<LiveTemplate[]>('/equb/templates');
}

export function listLiveRooms() {
  return req<ServerRoom[]>('/equb/rooms');
}

export function openRoom(templateId: string) {
  return req<ServerRoom>(`/equb/rooms/${encodeURIComponent(templateId)}/open`, {
    method: 'POST',
    body: '{}',
  });
}

export function fetchRoom(id: string) {
  return req<ServerRoom>(`/equb/rooms/${encodeURIComponent(id)}`);
}

/** Join with one or more picks (max = groupSize/5 on server) */
export function joinRoom(templateId: string, pickOrPicks: number | number[]) {
  const { playerId, name } = getPlayerIdentity();
  const picks = Array.isArray(pickOrPicks) ? pickOrPicks : [pickOrPicks];
  return req<ServerRoom>(`/equb/rooms/${encodeURIComponent(templateId)}/join`, {
    method: 'POST',
    body: JSON.stringify({
      playerId,
      name,
      picks,
      pick: picks[0],
    }),
  });
}

export type ServerWallet = {
  playerId: string;
  balance: number;
  updatedAt: number;
  version: number;
};

function walletBase(): string {
  const override =
    typeof window !== 'undefined' ? (window as any).__equbApiBase : undefined;
  return override !== undefined && override !== null
    ? String(override)
    : resolveApiBase();
}

export async function fetchServerWallet(playerId: string): Promise<ServerWallet> {
  const res = await fetch(
    `${walletBase()}/api/wallet/${encodeURIComponent(playerId)}`,
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || 'Wallet fetch failed');
  return (json.data || json) as ServerWallet;
}

export function subscribeServerBalance(
  playerId: string,
  onEvent: (ev: {
    balance: number;
    delta?: number;
    reason?: string;
    version?: number;
  }) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const es = new EventSource(
    `${walletBase()}/api/wallet/${encodeURIComponent(playerId)}/stream`,
  );
  es.onmessage = (msg) => {
    try {
      const data = JSON.parse(msg.data);
      if (data?.type === 'snapshot' && data.data)
        onEvent({ balance: data.data.balance, version: data.data.version });
      else if (typeof data?.balance === 'number') onEvent(data);
    } catch {
      /* ignore */
    }
  };
  return () => es.close();
}
