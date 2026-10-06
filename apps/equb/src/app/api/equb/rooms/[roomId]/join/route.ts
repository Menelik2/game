import { NextRequest, NextResponse } from 'next/server';
import { joinRoom, ensureOpen, getRoom } from '@/lib/server/equb-rooms';
import { joinShared, sharedEnabled, getShared } from '@/lib/server/shared-rooms';
import { settleJoinFee, readBalance } from '@/lib/server/wallet-settle';

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

    const id = decodeURIComponent(roomId);

    // Resolve contribution from room template
    let contribution = 0;
    let groupSize = 5;
    try {
      if (sharedEnabled()) {
        const r = await getShared(id);
        contribution = Number(r.contribution || 0);
        groupSize = Number(r.groupSize || 5);
      } else {
        const open = ensureOpen(id);
        contribution = Number(open.contribution || 0);
        groupSize = Number(open.groupSize || 5);
      }
    } catch {
      const m = /^equb-(\d+)-(\d+)/.exec(id);
      if (m) {
        groupSize = Number(m[1]);
        const pot = Number(m[2]);
        contribution = Math.round((pot / groupSize) * 100) / 100;
      }
    }

    const fee = Math.round(contribution * picks.length * 100) / 100;

    // Debit wallet FIRST — no join without payment
    let balanceAfter: number | null = null;
    try {
      const settled = await settleJoinFee({
        userId: playerId,
        amount: fee,
        roomId: id,
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
        ? await joinShared(id, playerId, name, picks)
        : joinRoom(id, playerId, name, picks);
    } catch (e: unknown) {
      // Refund on failed join
      try {
        if (fee > 0) {
          const { settleWinPayout } = await import('@/lib/server/wallet-settle');
          await settleWinPayout({
            userId: playerId,
            amount: fee,
            roomId: id,
            winningNumber: 0,
          });
        }
      } catch {
        /* */
      }
      return NextResponse.json(
        {
          success: false,
          message: e instanceof Error ? e.message : 'Join failed',
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
