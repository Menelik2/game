import { NextRequest, NextResponse } from 'next/server';
import {
  settleWinPayout,
  readBalance,
  computePayout,
} from '@/lib/server/wallet-settle';
import { peekShared, sharedEnabled } from '@/lib/server/shared-rooms';
import { getRoom } from '@/lib/server/equb-rooms';
import { requireUser } from '@/lib/server/session';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Winner claims payout once. Identity from session only. */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const ip = clientIp(req);
  const rl = rateLimit(`claim:${userId}:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, message: `Too many requests. Wait ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const templateId = String(body.templateId || body.roomId || '');
    const winningNumber = Number(body.winningNumber);
    if (!templateId || !Number.isFinite(winningNumber)) {
      return NextResponse.json(
        { success: false, message: 'roomId and winningNumber required' },
        { status: 400 },
      );
    }

    let prizePool = 0;
    let roomId = templateId;
    let winnerId: string | null = null;
    let paidOut = false;
    let serverPayout = 0;

    if (sharedEnabled()) {
      const room = await peekShared(templateId);
      if (!room) {
        return NextResponse.json(
          { success: false, message: 'Room not found' },
          { status: 404 },
        );
      }
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
        return NextResponse.json(
          { success: false, message: 'Room not found' },
          { status: 404 },
        );
      }
      prizePool = room.prizePool;
      roomId = room.id;
      winnerId = room.winnerId;
      paidOut = Boolean((room as { paidOut?: boolean }).paidOut);
      serverPayout = Number((room as { winnerPayout?: number }).winnerPayout || 0);
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
        { success: false, message: 'Only the winner can claim' },
        { status: 403 },
      );
    }

    if (paidOut) {
      return NextResponse.json({
        success: true,
        message: 'Already paid',
        balance: await readBalance(userId),
        alreadyPaid: true,
      });
    }

    const payout =
      serverPayout > 0 ? serverPayout : computePayout(prizePool).winnerPayout;

    const result = await settleWinPayout({
      userId,
      amount: payout,
      roomId,
      winningNumber,
    });

    return NextResponse.json({
      success: true,
      balance: result.balance ?? (await readBalance(userId)),
      payout,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'Claim failed',
      },
      { status: 400 },
    );
  }
}
