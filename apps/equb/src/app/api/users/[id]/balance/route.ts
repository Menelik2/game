import { NextRequest, NextResponse } from 'next/server';
import {
  dbAdjustBalance,
  dbGetUser,
  dbSetBalance,
  isDbConfigured,
} from '@/lib/server/db-users';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { success: false, code: 'DB_NOT_CONFIGURED' },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  const user = await dbGetUser(id);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: user });
}

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
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  try {
    if (body.balance != null && Number.isFinite(Number(body.balance))) {
      await dbSetBalance(id, Number(body.balance), String(body.reason || 'admin_set'));
    } else if (body.delta != null && Number.isFinite(Number(body.delta))) {
      await dbAdjustBalance(id, Number(body.delta), String(body.reason || 'adjust'));
    } else {
      return NextResponse.json(
        { success: false, message: 'Provide balance or delta' },
        { status: 400 },
      );
    }
    const user = await dbGetUser(id);
    return NextResponse.json({ success: true, data: user });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, message: e?.message || 'Failed' },
      { status: 400 },
    );
  }
}
