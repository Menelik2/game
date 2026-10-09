import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import {
  listAllSharedRooms,
  readSharedByTemplate,
  writeSharedRoom,
} from '@/lib/server/shared-rooms-list';
import {
  MIN_PLAYERS,
  ROUND_MS,
  getShared,
  type SharedRoom,
} from '@/lib/server/shared-rooms';
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
    id,
    templateId: prev.templateId,
    groupSize: prev.groupSize,
    prizePool: prev.prizePool,
    contribution:
      prev.contribution ||
      Math.round((prev.prizePool / prev.groupSize) * 100) / 100,
    status: 'open',
    adminClosed: false,
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
    gameId: id,
    joiningClosed: false,
    minPlayers: MIN_PLAYERS,
    maxPlayers: prev.groupSize,
    playerCount: 0,
    recent: (prev.recent || []).slice(0, 20),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return withSecurityHeaders(auth.response);

  try {
    const dbConfigured = isDbConfigured();
    const rooms = dbConfigured ? await listAllSharedRooms() : [];
    const open = rooms.filter((r) => r.status === 'open');
    const drawing = rooms.filter((r) => r.status === 'drawing');
    const completed = rooms.filter((r) => r.status === 'completed');
    const totalPlayers = rooms.reduce(
      (n, r) => n + (r.members?.length || r.playerCount || 0),
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
            dbConfigured,
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
          data: {
            rooms: [],
            summary: {
              total: 0,
              open: 0,
              drawing: 0,
              completed: 0,
              totalPlayers: 0,
              minPlayers: MIN_PLAYERS,
              roundMs: ROUND_MS,
              dbConfigured: isDbConfigured(),
            },
          },
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

  if (!isDbConfigured()) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message:
            'Database not configured. Set SUPABASE_URL + SERVICE_ROLE_KEY.',
        },
        { status: 503 },
      ),
    );
  }

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const action = String(body.action || '').trim();
    const templateId = String(body.templateId || body.template_id || '').trim();

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

    if (action === 'close_all') {
      const rooms = await listAllSharedRooms();
      let closed = 0;
      for (const r of rooms) {
        if (
          r.status !== 'open' &&
          r.status !== 'drawing' &&
          r.status !== 'waiting'
        ) {
          continue;
        }
        r.status = 'completed';
        r.adminClosed = true;
        r.joiningClosed = true;
        r.secondsLeft = 0;
        r.drawAt = Date.now();
        r.updatedAt = Date.now();
        const ok = await writeSharedRoom(r);
        if (ok) closed += 1;
      }
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message: `Closed ${closed} open/drawing room(s)`,
          data: { closed },
        }),
      );
    }

    if (!templateId) {
      return withSecurityHeaders(
        NextResponse.json(
          { success: false, message: 'templateId required (e.g. equb-5-500)' },
          { status: 400 },
        ),
      );
    }

    let room = await readSharedByTemplate(templateId);

    if (!room && (action === 'reset' || action === 'extend' || action === 'reopen')) {
      const m = /^equb-(\d+)-(\d+)$/.exec(templateId);
      const groupSize = m ? Number(m[1]) : 5;
      const prizePool = m ? Number(m[2]) : 500;
      const now = Date.now();
      room = {
        id: `${templateId}-${now}`,
        templateId,
        groupSize,
        prizePool,
        contribution: Math.round((prizePool / groupSize) * 100) / 100,
        status: 'open',
        adminClosed: false,
        members: [],
        winningNumber: null,
        winnerId: null,
        winnerName: null,
        entropyHex: null,
        commitmentHash: null,
        drawAt: now + ROUND_MS,
        secondsLeft: ROUND_MS / 1000,
        updatedAt: now,
        gameId: `${templateId}-${now}`,
        minPlayers: MIN_PLAYERS,
        maxPlayers: groupSize,
        playerCount: 0,
        recent: [],
      };
    }

    if (!room) {
      return withSecurityHeaders(
        NextResponse.json(
          {
            success: false,
            message: `Room not found: ${templateId}. Open it once from /rooms first.`,
          },
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
          message: 'Room reset — new 60s cycle started',
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
      room.adminClosed = false;
      room.joiningClosed = false;
      room.updatedAt = Date.now();
      const ok = await writeSharedRoom(room);
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
          message: `Timer extended by ${seconds}s`,
          data: room,
        }),
      );
    }

    if (action === 'force_draw') {
      if (room.adminClosed) {
        return withSecurityHeaders(
          NextResponse.json(
            { success: false, message: 'Room is closed by admin — reopen first' },
            { status: 400 },
          ),
        );
      }
      room.drawAt = Date.now() - 1000;
      room.secondsLeft = 0;
      room.status = 'open';
      room.updatedAt = Date.now();
      await writeSharedRoom(room);
      const after = await getShared(templateId);
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message:
            (after.members?.length || 0) < MIN_PLAYERS
              ? `Need ${MIN_PLAYERS} players to draw (have ${after.members?.length || 0}). Timer reset.`
              : `Draw ran · status ${after.status}`,
          data: after,
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
      if (room.adminClosed) {
        return withSecurityHeaders(
          NextResponse.json(
            { success: false, message: 'Room is closed by admin — use Reopen' },
            { status: 400 },
          ),
        );
      }
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
      room.playerCount = 0;
      room.updatedAt = Date.now();
      room.status = 'open';
      room.joiningClosed = false;
      room.adminClosed = false;
      room.drawAt = Date.now() + ROUND_MS;
      room.secondsLeft = ROUND_MS / 1000;
      room.winningNumber = null;
      room.winnerId = null;
      room.winnerName = null;
      await writeSharedRoom(room);
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message: 'All members cleared — new timer started',
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
      room.playerCount = room.members.length;
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

    if (action === 'close') {
      room.status = 'completed';
      room.adminClosed = true;
      room.joiningClosed = true;
      room.secondsLeft = 0;
      room.drawAt = Date.now();
      room.updatedAt = Date.now();
      const ok = await writeSharedRoom(room);
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
          message: `Game closed (${room.templateId}). Players cannot join until reopened.`,
          data: room,
        }),
      );
    }

    if (action === 'reopen') {
      const next = freshCycle(room);
      next.adminClosed = false;
      next.joiningClosed = false;
      next.status = 'open';
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
          message: `Room reopened (${room.templateId}) — new cycle`,
          data: next,
        }),
      );
    }

    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message:
            'Unknown action. Use: close | close_all | reopen | reset | extend | force_draw | close_joining | open_joining | clear_members | kick',
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
