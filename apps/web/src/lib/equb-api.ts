import { api, isApiConfigured, ApiError } from './api';
import type { EqubRoom } from './equb-logic';

export type LiveTemplate = {
  id: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  tier: string;
  liveRoomId: string | null;
  seatsTaken: number;
  status: string;
  secondsLeft?: number;
};

/** Normalize Nest room shape → client EqubRoom */
export function mapApiRoom(raw: any): EqubRoom {
  return {
    id: raw.id,
    groupSize: raw.groupSize,
    prizePool: raw.prizePool,
    contribution: raw.contribution,
    tier: raw.tier || 'entry',
    status: raw.status || 'open',
    members: (raw.members || []).map((m: any) => ({
      playerId: m.playerId,
      name: m.name,
      pick: m.pick,
      joinedAt: m.joinedAt || Date.now(),
      isBot: String(m.playerId || '').startsWith('bot-'),
    })),
    winningNumber: raw.winningNumber ?? null,
    winnerId: raw.winnerId ?? null,
    entropyHex: raw.entropyHex ?? null,
    commitmentHash: raw.commitmentHash ?? null,
    createdAt: raw.createdAt || Date.now(),
    updatedAt: raw.updatedAt || Date.now(),
  };
}

export async function equbPing(): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await api<{ ok: boolean }>('/equb/ping');
    return true;
  } catch {
    return false;
  }
}

export async function equbTemplates(): Promise<LiveTemplate[]> {
  const data = await api<LiveTemplate[] | { items: LiveTemplate[] }>('/equb/templates');
  return Array.isArray(data) ? data : (data as any).items || [];
}

export async function equbGetRoom(roomId: string): Promise<EqubRoom> {
  const data = await api<any>(`/equb/rooms/${encodeURIComponent(roomId)}`);
  return mapApiRoom(data);
}

export async function equbJoin(
  templateId: string,
  body: { playerId: string; name: string; pick: number },
): Promise<EqubRoom> {
  const data = await api<any>(`/equb/rooms/${encodeURIComponent(templateId)}/join`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return mapApiRoom(data);
}

export async function equbFillBots(roomId: string, count?: number): Promise<EqubRoom> {
  const data = await api<any>(`/equb/rooms/${encodeURIComponent(roomId)}/fill-bots`, {
    method: 'POST',
    body: JSON.stringify(count != null ? { count } : {}),
  });
  return mapApiRoom(data);
}

export async function equbDraw(roomId: string, playerId?: string): Promise<EqubRoom> {
  const data = await api<any>(`/equb/rooms/${encodeURIComponent(roomId)}/draw`, {
    method: 'POST',
    body: JSON.stringify(playerId ? { playerId } : {}),
  });
  return mapApiRoom(data);
}

export async function equbOpen(templateId: string): Promise<EqubRoom> {
  const data = await api<any>(`/equb/rooms/${encodeURIComponent(templateId)}/open`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return mapApiRoom(data);
}

export function equbErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Request failed';
}
