import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import {
  listAllSharedRooms,
  readSharedByTemplate,
  writeSharedRoom,
} from '@/lib/server/shared-rooms-list';
import { MIN_PLAYERS, ROUND_MS, type SharedRoom } from '@/lib/server/shared-rooms';
import { isDbConfigured } from '@/lib/server/db-users';
import {
  assertBodySize,
  originAllowed,
  forbiddenOrigin,
  withSecurityHeaders,
} from '@/lib/server/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function freshCycle(prev: SharedRoom): SharedRoom {
  const now = Date.now();
  const id = `${prev.templateId}-${now}`;
  return {
    ...prev,
    id,
    gameId: id,
    status: 'open',
    members: [],
    winningNumber: null,
    winnerId: null,
    winnerName: null,
    adminFee: null,
    winnerPayout: null,
    collectedPot: null,
    paidOut: false,
    entropyHex: null,
    commitmentHash: null,
    drawAt: now + ROUND_MS,
    secondsLeft: ROUND_MS / 1000,
    updatedAt: now,
    joiningClosed: false,
    recent: (prev.recent || []).slice(0, 20),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return withSecurityHeaders(auth.response);

  try {
    const rooms = await listAllSharedRooms();
    const open = rooms.filter((r) => r.status === 'open');
    const drawing = rooms.filter((r) => r.status === 'drawing');
    const completed = rooms.filter((r) => r.status === 'completed');
    const totalPlayers = rooms.reduce(
      (n, r) => n + (r.members?.length || 0),
      0,
    );

    return withSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          rooms,
          summary: {
            total: rooms.length,
            open: open.length,
            drawing: drawing.length,
            completed: completed.length,
            totalPlayers,
            minPlayers: MIN_PLAYERS,
            roundMs: ROUND_MS,
            dbConfigured: isDbConfigured(),
          },
        },
      }),
    );
  } catch (e: unknown) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: e instanceof Error ? e.message : 'Failed to list games',
        },
        { status: 500 },
      ),
    );
  }
}

export async function POST(req: NextRequest) {
  const tooBig = assertBodySize(req);
  if (tooBig) return withSecurityHeaders(tooBig);
  if (!originAllowed(req)) return withSecurityHeaders(forbiddenOrigin());

  const auth = await requireAdmin(req);
  if (!auth.ok) return withSecurityHeaders(auth.response);

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action = String(body.action || '').trim();
    const templateId = String(body.templateId || '').trim();

    if (!action) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'action required' },
          { status: 400 },
        ),
      );
    }

    if (action === 'list') {
      const rooms = await listAllSharedRooms();
      return withSecurityHeaders(
        NextResponse.json({ success: true, data: { rooms } }),
      );
    }

    if (!templateId) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'templateId required' },
          { status: 400 },
        ),
      );
    }

    const room = await readSharedByTemplate(templateId);
    if (!room) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'Room not found' },
          { status: 404 },
        ),
      );
    }

    if (action === 'reset') {
      const next = freshCycle(room);
      const ok = await writeSharedRoom(next);
      if (!ok) {
        return withSecurityHeaders(
          NextResponse.json(
            { success: false, message: 'DB write failed' },
            { status: 500 },
          ),
        );
      }
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message: 'Room reset — new cycle started',
          data: next,
        }),
      );
    }

    if (action === 'extend') {
      const seconds = Math.min(
        300,
        Math.max(15, Number(body.seconds) || 60),
      );
      room.drawAt = Date.now() + seconds * 1000;
      room.secondsLeft = seconds;
      room.status = 'open';
      room.joiningClosed = false;
      room.updatedAt = Date.now();
      await writeSharedRoom(room);
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message: `Timer extended by ${seconds}s`,
          data: room,
        }),
      );
    }

    if (action === 'close_joining') {
      room.joiningClosed = true;
      room.updatedAt = Date.now();
      await writeSharedRoom(room);
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message: 'Joining closed',
          data: room,
        }),
      );
    }

    if (action === 'open_joining') {
      room.joiningClosed = false;
      room.status = 'open';
      room.updatedAt = Date.now();
      await writeSharedRoom(room);
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message: 'Joining re-opened',
          data: room,
        }),
      );
    }

    if (action === 'clear_members') {
      room.members = [];
      room.updatedAt = Date.now();
      room.status = 'open';
      room.joiningClosed = false;
      room.drawAt = Date.now() + ROUND_MS;
      room.secondsLeft = ROUND_MS / 1000;
      await writeSharedRoom(room);
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message: 'All members cleared',
          data: room,
        }),
      );
    }

    if (action === 'kick') {
      const playerId = String(body.playerId || '').trim();
      if (!playerId) {
        return withSecurityHeaders(
          NextResponse.json(
            { success: false, message: 'playerId required' },
            { status: 400 },
          ),
        );
      }
      room.members = (room.members || []).filter((m) => m.playerId !== playerId);
      room.updatedAt = Date.now();
      await writeSharedRoom(room);
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message: 'Player kicked',
          data: room,
        }),
      );
    }

    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message:
            'Unknown action. Use: reset | extend | close_joining | open_joining | clear_members | kick',
        },
        { status: 400 },
      ),
    );
  } catch (e: unknown) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: e instanceof Error ? e.message : 'Action failed',
        },
        { status: 500 },
      ),
    );
  }
}
