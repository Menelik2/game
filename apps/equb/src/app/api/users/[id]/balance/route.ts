import { NextRequest, NextResponse } from 'next/server';
import {
  dbAdjustBalance,
  dbGetUser,
  dbSetBalance,
  isDbConfigured,
} from '@/lib/server/db-users';
import { requireAdmin } from '@/lib/server/admin-auth';
import { requireUser } from '@/lib/server/session';
import { rateLimit, clientIp } from '@/lib/server/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Own balance only (session), or admin can read any. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { success: false, code: 'DB_NOT_CONFIGURED' },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  const isSelf = auth.user.id === id;
  const isAdmin = String(auth.user.role || '').toLowerCase() === 'admin';
  if (!isSelf && !isAdmin) {
    return NextResponse.json(
      { success: false, message: 'Forbidden' },
      { status: 403 },
    );
  }

  const user = await dbGetUser(id);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: user });
}

/**
 * Set absolute balance → admin only.
 * Delta adjust → admin only (game fees/wins settle server-side on join/draw).
 * This blocks attackers from minting balance via public API.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { success: false, code: 'DB_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const ip = clientIp(req);
  const rl = rateLimit(`bal-admin:${auth.admin.id}:${ip}`, 40, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { success: false, message: 'Rate limited' },
      { status: 429 },
    );
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    if (body.balance != null && Number.isFinite(Number(body.balance))) {
      const bal = Number(body.balance);
      if (bal < 0 || bal > 10_000_000) {
        return NextResponse.json(
          { success: false, message: 'Invalid balance' },
          { status: 400 },
        );
      }
      await dbSetBalance(id, bal, String(body.reason || 'admin_set').slice(0, 64));
    } else if (body.delta != null && Number.isFinite(Number(body.delta))) {
      const delta = Number(body.delta);
      if (Math.abs(delta) > 1_000_000) {
        return NextResponse.json(
          { success: false, message: 'Delta too large' },
          { status: 400 },
        );
      }
      await dbAdjustBalance(
        id,
        delta,
        String(body.reason || 'admin_adjust').slice(0, 64),
      );
    } else {
      return NextResponse.json(
        { success: false, message: 'Provide balance or delta' },
        { status: 400 },
      );
    }
    const user = await dbGetUser(id);
    return NextResponse.json({ success: true, data: user });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'Failed',
      },
      { status: 400 },
    );
  }
}
