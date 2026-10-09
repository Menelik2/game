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

export async function listSharedOpen(): Promise<SharedRoom[]> {
  if (!isDbConfigured()) return [];
  try {
    const { data, error } = await sb()
      .from('equb_live_rooms')
      .select('payload')
      .limit(80);
    if (error || !data) return [];
    const now = Date.now();
    return data
      .map((row) => (row as { payload?: SharedRoom }).payload)
      .filter((room): room is SharedRoom => Boolean(room && room.status === 'open'))
      .map((room) => ({
        ...room,
        secondsLeft: Math.max(0, Math.ceil((Number(room.drawAt) - now) / 1000)),
      }));
  } catch {
    return [];
  }
}

/** Admin: all live room rows regardless of status */
export async function listAllSharedRooms(): Promise<SharedRoom[]> {
  if (!isDbConfigured()) return [];
  try {
    const { data, error } = await sb()
      .from('equb_live_rooms')
      .select('payload, updated_at')
      .order('updated_at', { ascending: false })
      .limit(120);
    if (error || !data) return [];
    const now = Date.now();
    return data
      .map((row) => (row as { payload?: SharedRoom }).payload)
      .filter((room): room is SharedRoom => Boolean(room))
      .map((room) => ({
        ...room,
        secondsLeft: Math.max(0, Math.ceil((Number(room.drawAt) - now) / 1000)),
        playerCount: (room.members || []).length,
        maxPlayers: room.groupSize,
        minPlayers: room.minPlayers ?? 5,
      }));
  } catch {
    return [];
  }
}

export async function writeSharedRoom(room: SharedRoom): Promise<boolean> {
  if (!isDbConfigured()) return false;
  try {
    await sb().from('equb_live_rooms').upsert({
      template_id: room.templateId,
      payload: room,
      updated_at: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function readSharedByTemplate(
  templateId: string,
): Promise<SharedRoom | null> {
  if (!isDbConfigured()) return null;
  try {
    const { data, error } = await sb()
      .from('equb_live_rooms')
      .select('payload')
      .eq('template_id', templateId)
      .maybeSingle();
    if (error || !data?.payload) return null;
    return data.payload as SharedRoom;
  } catch {
    return null;
  }
}
