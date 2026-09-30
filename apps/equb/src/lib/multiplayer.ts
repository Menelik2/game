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
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier: string;
  status: 'open' | 'completed';
  members: Array<{ playerId: string; name: string; pick: number; joinedAt: number }>;
  winningNumber: number | null;
  winnerId: string | null;
  entropyHex: string | null;
  commitmentHash: string | null;
  createdAt: number;
  updatedAt: number;
};

export type ServerTemplate = {
  id: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier: string;
  liveRoomId: string | null;
  seatsTaken: number;
  status: string;
};

async function equbFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Bad response (${res.status})`);
  }
  if (!res.ok) {
    const msg = json?.message || json?.error?.message || `Error ${res.status}`;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return (json?.data !== undefined ? json.data : json) as T;
}

export function getPlayerIdentity(): { playerId: string; name: string } {
  if (typeof window === 'undefined') return { playerId: 'ssr', name: 'Player' };
  let playerId = localStorage.getItem('equb_player_id');
  if (!playerId) {
    playerId = `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem('equb_player_id', playerId);
  }
  const name = localStorage.getItem('equb_player_name') || 'Player';
  return { playerId, name };
}

export function setPlayerName(name: string) {
  localStorage.setItem('equb_player_name', name.slice(0, 40));
}

export async function fetchTemplates(): Promise<ServerTemplate[]> {
  return equbFetch('/equb/templates');
}

export async function openRoom(templateId: string): Promise<ServerRoom> {
  return equbFetch(`/equb/rooms/${encodeURIComponent(templateId)}/open`, {
    method: 'POST',
    body: '{}',
  });
}

export async function joinRoom(templateId: string, pick: number): Promise<ServerRoom> {
  const { playerId, name } = getPlayerIdentity();
  return equbFetch(`/equb/rooms/${encodeURIComponent(templateId)}/join`, {
    method: 'POST',
    body: JSON.stringify({ playerId, name, pick }),
  });
}

export async function fetchRoom(roomId: string): Promise<ServerRoom> {
  return equbFetch(`/equb/rooms/${encodeURIComponent(roomId)}`);
}

export async function drawRoom(roomId: string): Promise<ServerRoom> {
  const { playerId } = getPlayerIdentity();
  return equbFetch(`/equb/rooms/${encodeURIComponent(roomId)}/draw`, {
    method: 'POST',
    body: JSON.stringify({ playerId }),
  });
}
