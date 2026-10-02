/** Real multiplayer client — NestJS /api/equb */

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
    if (u.hostname === window.location.hostname) return false;
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
  /** Unix ms when auto-draw fires */
  drawAt?: number;
  /** Seconds until next draw (from API) */
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
    (typeof window !== 'undefined' && localStorage.getItem('equb_player_name')) || 'Player';
  return { playerId, name };
}

export function setPlayerName(name: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('equb_player_name', name.slice(0, 40));
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
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
}

export function openRoom(templateId: string) {
  return req<ServerRoom>(`/equb/rooms/${templateId}/open`, { method: 'POST', body: '{}' });
}

export function fetchRoom(id: string) {
  return req<ServerRoom>(`/equb/rooms/${id}`);
}

export function joinRoom(templateId: string, pick: number) {
  const { playerId, name } = getPlayerIdentity();
  return req<ServerRoom>(`/equb/rooms/${templateId}/join`, {
    method: 'POST',
    body: JSON.stringify({ playerId, name, pick }),
  });
}

export function drawRoom(roomId: string) {
  const { playerId } = getPlayerIdentity();
  return req<ServerRoom>(`/equb/rooms/${roomId}/draw`, {
    method: 'POST',
    body: JSON.stringify({ playerId }),
  });
}
