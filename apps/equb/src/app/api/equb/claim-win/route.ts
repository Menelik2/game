import { NextRequest, NextResponse } from 'next/server';
import { settleWinPayout, readBalance, computePayout } from '@/lib/server/wallet-settle';
import { peekShared, sharedEnabled } from '@/lib/server/shared-rooms';
import { getRoom } from '@/lib/server/equb-rooms';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Winner claims payout once. Server draw already credits; this must not pay twice. */
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
    let status = '';
    let serverPayout = 0;

    if (sharedEnabled()) {
      const room = await peekShared(templateId);
      if (!room) {
        return NextResponse.json({ success: false, message: 'Room not found' }, { status: 404 });
      }
      status = room.status;
      prizePool = Number(room.prizePool || 0);
      roomId = room.id;
      winnerId = room.winnerId;
      paidOut = Boolean(room.paidOut);
      serverPayout = Number(room.winnerPayout || 0);
      if (room.status !== 'completed') {
        return NextResponse.json(
          { success: false, message: 'Round not completed yet' },
          { status: 400 },
        );
      }
      if (room.winningNumber !== winningNumber) {
        return NextResponse.json(
          { success: false, message: 'Winning number mismatch' },
          { status: 400 },
        );
      }
    } else {
      const room = getRoom(String(body.roomId || '')) || getRoom(templateId);
      if (!room) {
        return NextResponse.json({ success: false, message: 'Room not found' }, { status: 404 });
      }
      status = room.status;
      prizePool = room.prizePool;
      roomId = room.id;
      winnerId = room.winnerId;
      paidOut = Boolean(room.paidOut);
      if (room.status !== 'completed') {
        return NextResponse.json(
          { success: false, message: 'Round not completed yet' },
          { status: 400 },
        );
      }
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
    const amount = serverPayout > 0 ? serverPayout : winnerPayout;

    if (paidOut) {
      return NextResponse.json({
        success: true,
        credited: false,
        alreadyPaid: true,
        balance: await readBalance(userId),
        amount,
        status,
      });
    }

    const result = await settleWinPayout({
      userId,
      amount,
      roomId,
      winningNumber,
    });

    return NextResponse.json({
      success: true,
      credited: result.credited,
      alreadyPaid: !result.credited,
      balance: result.balance ?? (await readBalance(userId)),
      amount,
      status,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Claim failed' },
      { status: 400 },
    );
  }
}
