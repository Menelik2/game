import { NextRequest, NextResponse } from 'next/server';
import { joinRoom, ensureOpen } from '@/lib/server/equb-rooms';
import {
  joinShared,
  sharedEnabled,
  getShared,
  peekShared,
} from '@/lib/server/shared-rooms';
import {
  settleJoinFee,
  readBalance,
  refundJoinFee,
} from '@/lib/server/wallet-settle';
import { requireUser } from '@/lib/server/session';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';
import { sanitizeUserText } from '@/lib/server/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await ctx.params;

  // Identity from signed session only — never trust body.playerId
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const playerId = auth.user.id;
  const name = sanitizeUserText(auth.user.fullName || 'Player', 40);

  const ip = clientIp(req);
  const rl = rateLimit(`join:${playerId}:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, message: `Too many joins. Wait ${rl.retryAfterSec}s.` },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    let picks: number[] = [];
    if (Array.isArray(body.picks)) {
      picks = body.picks.map((n: unknown) => Number(n));
    } else if (body.pick != null) {
      picks = [Number(body.pick)];
    }
    if (picks.length === 0 || picks.some((p) => !Number.isFinite(p))) {
      return NextResponse.json(
        { success: false, message: 'Valid pick(s) required' },
        { status: 400 },
      );
    }
    // Cap pick count to prevent abuse
    picks = picks.slice(0, 5).map((p) => Math.floor(p));

    const templateId = decodeURIComponent(roomId);

    let contribution = 0;
    let liveRoomId = templateId;
    let alreadyIn = false;

    if (sharedEnabled()) {
      const r = await getShared(templateId);
      contribution = Number(r.contribution || 0);
      liveRoomId = r.id;
      alreadyIn = r.members.some((m) => m.playerId === playerId);
      if (r.status !== 'open') {
        return NextResponse.json(
          { success: false, message: 'Round closed — wait for next round' },
          { status: 400 },
        );
      }
    } else {
      const open = ensureOpen(templateId);
      contribution = Number(open.contribution || 0);
      liveRoomId = open.id;
      alreadyIn = open.members.some((m) => m.playerId === playerId);
      if (open.status !== 'open') {
        return NextResponse.json(
          { success: false, message: 'Round closed — wait for next round' },
          { status: 400 },
        );
      }
    }

    if (alreadyIn) {
      const room = sharedEnabled()
        ? await peekShared(templateId)
        : ensureOpen(templateId);
      return NextResponse.json({
        success: true,
        data: room,
        fee: 0,
        balance: await readBalance(playerId),
        alreadyJoined: true,
      });
    }

    const fee = Math.round(contribution * picks.length * 100) / 100;

    let balanceAfter: number | null = null;
    try {
      const settled = await settleJoinFee({
        userId: playerId,
        amount: fee,
        roomId: liveRoomId,
        picks,
      });
      balanceAfter = settled.balance;
    } catch (e: unknown) {
      return NextResponse.json(
        {
          success: false,
          message: e instanceof Error ? e.message : 'Insufficient balance',
          balance: await readBalance(playerId),
        },
        { status: 400 },
      );
    }

    let room;
    try {
      room = sharedEnabled()
        ? await joinShared(templateId, playerId, name, picks)
        : joinRoom(templateId, playerId, name, picks);
    } catch (e: unknown) {
      try {
        await refundJoinFee({
          userId: playerId,
          amount: fee,
          roomId: liveRoomId,
        });
      } catch {
        /* */
      }
      return NextResponse.json(
        {
          success: false,
          message: e instanceof Error ? e.message : 'Join failed',
          balance: await readBalance(playerId),
        },
        { status: 400 },
      );
    }

    balanceAfter = (await readBalance(playerId)) ?? balanceAfter;

    return NextResponse.json({
      success: true,
      data: room,
      fee,
      balance: balanceAfter,
      shared: sharedEnabled(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'Join failed',
      },
      { status: 400 },
    );
  }
}
