import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/server/db-users';
import { sharedEnabled } from '@/lib/server/shared-rooms';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const database = isDbConfigured();
  const shared = sharedEnabled();
  let usersCount: number | null = null;
  let roomsTable = false;
  let depositsTable = false;

  if (database) {
    try {
      const { count } = await sb()
        .from('app_users')
        .select('id', { count: 'exact', head: true });
      usersCount = count ?? 0;
    } catch {
      usersCount = null;
    }
    try {
      const { error } = await sb().from('equb_live_rooms').select('template_id').limit(1);
      roomsTable = !error;
    } catch {
      roomsTable = false;
    }
    try {
      const { error } = await sb().from('wallet_deposits').select('id').limit(1);
      depositsTable = !error;
    } catch {
      depositsTable = false;
    }
  }

  const verifyEt = Boolean(
    process.env.VERIFY_ET_API_KEY ||
      process.env.VERIFY_BANK_ET_API_KEY ||
      process.env.VERIFY_ET_KEY,
  );
  const sessionSecret = Boolean(
    process.env.SESSION_SECRET || process.env.PASSWORD_PEPPER,
  );

  const readyFor500 =
    database && shared && roomsTable && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return NextResponse.json({
    success: true,
    service: 'fast-equb-next-api',
    timestamp: new Date().toISOString(),
    connection: {
      mode: 'same-origin',
      frontend: process.env.NEXT_PUBLIC_APP_URL || 'https://abelgame.vercel.app',
      api: 'https://abelgame.vercel.app/api/*',
      note: 'Auth, rooms, wallet run on abelgame. Do not point login at game-rho.',
    },
    database: {
      configured: database,
      usersCount,
      tables: {
        app_users: database,
        equb_live_rooms: roomsTable,
        wallet_deposits: depositsTable,
      },
    },
    multiplayer: {
      sharedRooms: shared,
      engine: shared ? 'supabase-equb_live_rooms' : 'memory-not-scalable',
    },
    security: {
      sessionSecret,
      verifyEtKey: verifyEt,
    },
    capacity: {
      targetUsers: 500,
      ready: readyFor500,
      checklist: [
        database ? 'OK database' : 'MISSING Supabase env',
        roomsTable ? 'OK equb_live_rooms' : 'RUN SQL equb_live_rooms',
        depositsTable ? 'OK wallet_deposits' : 'RUN SQL wallet_deposits',
        sessionSecret ? 'OK SESSION_SECRET' : 'SET SESSION_SECRET',
        verifyEt ? 'OK VERIFY_ET_API_KEY' : 'Optional VERIFY_ET_API_KEY',
      ],
    },
  });
}
