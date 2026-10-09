import { isDbConfigured } from './db-users';
import { createClient } from '@supabase/supabase-js';
import type { SharedRoom } from './shared-rooms';

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return createClient(url, key, { auth: { persistSession: false } });
}

function normalizeRoom(room: SharedRoom): SharedRoom {
  const now = Date.now();
  const members = Array.isArray(room.members) ? room.members : [];
  return {
    ...room,
    members,
    secondsLeft: Math.max(0, Math.ceil((Number(room.drawAt) - now) / 1000)),
    playerCount: members.length,
    maxPlayers: room.groupSize,
    minPlayers: room.minPlayers ?? 5,
  };
}

export async function listSharedOpen(): Promise<SharedRoom[]> {
  const all = await listAllSharedRooms();
  return all.filter((room) => room.status === 'open');
}

/** Admin: all live room rows regardless of status */
export async function listAllSharedRooms(): Promise<SharedRoom[]> {
  if (!isDbConfigured()) return [];
  try {
    // Prefer ordered query; fall back without order if column/index missing
    let data: unknown[] | null = null;
    const primary = await sb()
      .from('equb_live_rooms')
      .select('payload, updated_at')
      .order('updated_at', { ascending: false })
      .limit(120);

    if (primary.error) {
      const fallback = await sb()
        .from('equb_live_rooms')
        .select('payload')
        .limit(120);
      if (fallback.error || !fallback.data) return [];
      data = fallback.data;
    } else {
      data = primary.data;
    }

    if (!data) return [];

    return data
      .map((row) => {
        const r = row as { payload?: SharedRoom | string };
        let payload = r.payload;
        if (typeof payload === 'string') {
          try {
            payload = JSON.parse(payload) as SharedRoom;
          } catch {
            return null;
          }
        }
        if (!payload || typeof payload !== 'object') return null;
        if (!payload.templateId && !payload.id) return null;
        return normalizeRoom(payload as SharedRoom);
      })
      .filter((room): room is SharedRoom => Boolean(room));
  } catch {
    return [];
  }
}

export async function writeSharedRoom(room: SharedRoom): Promise<boolean> {
  if (!isDbConfigured()) return false;
  if (!room.templateId) return false;
  try {
    const { error } = await sb().from('equb_live_rooms').upsert({
      template_id: room.templateId,
      payload: room,
      updated_at: new Date().toISOString(),
    });
    return !error;
  } catch {
    return false;
  }
}

export async function readSharedByTemplate(
  templateId: string,
): Promise<SharedRoom | null> {
  if (!isDbConfigured() || !templateId) return null;
  try {
    const { data, error } = await sb()
      .from('equb_live_rooms')
      .select('payload')
      .eq('template_id', templateId)
      .maybeSingle();
    if (error || !data?.payload) return null;
    let payload = data.payload as SharedRoom | string;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload) as SharedRoom;
      } catch {
        return null;
      }
    }
    return normalizeRoom(payload as SharedRoom);
  } catch {
    return null;
  }
}
