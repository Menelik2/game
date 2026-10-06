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
        secondsLeft: Math.max(0, Math.ceil((room.drawAt - now) / 1000)),
      }));
  } catch {
    return [];
  }
}
