import { NextRequest, NextResponse } from 'next/server';
import { settleWinPayout, readBalance, computePayout } from '@/lib/server/wallet-settle';
import { getShared, sharedEnabled } from '@/lib/server/shared-rooms';
import { getRoom } from '@/lib/server/equb-rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Client fallback if server payout was missed: winner claims once.
 * Body: { userId, roomId, templateId?, winningNumber }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = String(body.userId || body.playerId || '');
    const templateId = String(body.templateId || body.roomId || '');
    const winningNumber = Number(body.winningNumber);
    if (!userId || !templateId || !Number.isFinite(winningNumber)) {
      return NextResponse.json(
        { success: false, message: 'userId, roomId, winningNumber required' },
        { status: 400 },
      );
    }

    let prizePool = 0;
    let roomId = templateId;
    let winnerId: string | null = null;
    let paidOut = false;

    if (sharedEnabled()) {
      const room = await getShared(templateId);
      prizePool = Number(room.prizePool || 0);
      roomId = room.id;
      winnerId = room.winnerId;
      paidOut = Boolean(room.paidOut);
      if (room.winningNumber !== winningNumber) {
        return NextResponse.json(
          { success: false, message: 'Winning number mismatch' },
          { status: 400 },
        );
      }
    } else {
      const room = getRoom(templateId) || getRoom(body.roomId);
      if (!room) {
        return NextResponse.json({ success: false, message: 'Room not found' }, { status: 404 });
      }
      prizePool = room.prizePool;
      roomId = room.id;
      winnerId = room.winnerId;
      paidOut = Boolean(room.paidOut);
      if (room.winningNumber !== winningNumber) {
        return NextResponse.json(
          { success: false, message: 'Winning number mismatch' },
          { status: 400 },
        );
      }
    }

    if (winnerId && winnerId !== userId) {
      return NextResponse.json(
        { success: false, message: 'Not the winner of this round' },
        { status: 403 },
      );
    }

    const { winnerPayout } = computePayout(prizePool);
    const result = await settleWinPayout({
      userId,
      amount: winnerPayout,
      roomId,
      winningNumber,
    });

    return NextResponse.json({
      success: true,
      credited: result.credited,
      alreadyPaid: paidOut && !result.credited,
      balance: result.balance ?? (await readBalance(userId)),
      amount: winnerPayout,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || 'Claim failed' },
      { status: 400 },
    );
  }
}
