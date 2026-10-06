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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await ctx.params;
  try {
    const body = await req.json().catch(() => ({}));
    const playerId = String(body.playerId || body.userId || '');
    const name = String(body.name || 'Player');
    let picks: number[] = [];
    if (Array.isArray(body.picks)) {
      picks = body.picks.map((n: unknown) => Number(n));
    } else if (body.pick != null) {
      picks = [Number(body.pick)];
    }
    if (!playerId || picks.length === 0 || picks.some((p) => !Number.isFinite(p))) {
      return NextResponse.json(
        { success: false, message: 'playerId and pick(s) required' },
        { status: 400 },
      );
    }

    const templateId = decodeURIComponent(roomId);

    // Resolve open room (live instance id needed for fee key)
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
        await refundJoinFee({ userId: playerId, amount: fee, roomId: liveRoomId });
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
