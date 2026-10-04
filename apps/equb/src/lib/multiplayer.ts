/** Real multiplayer client — NestJS /api/equb · falls back when API down */

const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

export function isMultiplayerEnabled(): boolean {
  if (!API) return false;
  if (typeof window === 'undefined') return !!API;
  try {
    const u = new URL(API);
    if (
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

export type ServerRoom = {
  id: string;
  templateId?: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier: string;
  status: 'open' | 'drawing' | 'completed';
  members: Array<{ playerId: string; name: string; pick: number; joinedAt: number }>;
  winningNumber: number | null;
  winnerId: string | null;
  entropyHex?: string | null;
  commitmentHash?: string | null;
  drawAt?: number;
  secondsLeft?: number;
  updatedAt?: number;
};

function pid() {
  if (typeof window === 'undefined') return 'ssr';
  let id = localStorage.getItem('equb_player_id');
  if (!id) {
    id = `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem('equb_player_id', id);
  }
  return id;
}

export function getPlayerIdentity() {
  const playerId = pid();
  const name =
    (typeof window !== 'undefined' && localStorage.getItem('equb_player_name')) ||
    'Player';
  return { playerId, name };
}

export function setPlayerName(name: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('equb_player_name', name.slice(0, 40));
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API) throw new Error('API not configured');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch(`${API}/api${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
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

/** Returns true if backend health responds quickly */
export async function probeApi(): Promise<boolean> {
  if (!isMultiplayerEnabled()) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5_000);
    const res = await fetch(`${API}/api/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
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

export function joinRoom(templateId: string, pick: number) {
  const { playerId, name } = getPlayerIdentity();
  return req<ServerRoom>(`/equb/rooms/${encodeURIComponent(templateId)}/join`, {
    method: 'POST',
    body: JSON.stringify({ playerId, name, pick }),
  });
}
