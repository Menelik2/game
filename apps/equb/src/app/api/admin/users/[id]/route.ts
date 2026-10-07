import { NextRequest, NextResponse } from 'next/server';
import { adminDelete, adminUpdate } from '@/lib/server/admin-users';
import { requireAdmin, sanitizeText } from '@/lib/server/admin-auth';
import { pushAudit } from '@/lib/server/audit';
import { normalizePhone } from '@/lib/password';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (!id || id.length > 80) {
    return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const patch: Record<string, unknown> = {};

    if (body.fullName != null) patch.fullName = sanitizeText(body.fullName, 80);
    if (body.phone != null) {
      const phone = normalizePhone(String(body.phone));
      if (!phone) {
        return NextResponse.json(
          { success: false, message: 'Invalid phone' },
          { status: 400 },
        );
      }
      patch.phone = phone;
    }
    if (body.password != null) {
      const pw = String(body.password);
      if (pw.length > 0 && pw.length < 6) {
        return NextResponse.json(
          { success: false, message: 'Password must be at least 6 characters' },
          { status: 400 },
        );
      }
      if (pw.length >= 6) patch.password = pw;
    }
    if (body.balance != null) {
      const bal = Number(body.balance);
      if (!Number.isFinite(bal) || bal < 0 || bal > 10_000_000) {
        return NextResponse.json(
          { success: false, message: 'Invalid balance' },
          { status: 400 },
        );
      }
      patch.balance = bal;
    }
    if (body.role != null) {
      patch.role = body.role === 'admin' ? 'admin' : 'player';
    }
    if (body.banned != null) patch.banned = Boolean(body.banned);

    const data = await adminUpdate(id, patch);
    pushAudit({
      action: 'admin.user.update',
      entity: 'user',
      entityId: id,
      userId: auth.admin.id,
      meta: { keys: Object.keys(patch) },
    });
    return NextResponse.json({ success: true, data });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Update failed' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (id === auth.admin.id) {
    return NextResponse.json(
      { success: false, message: 'Cannot delete your own admin account' },
      { status: 400 },
    );
  }

  try {
    await adminDelete(id);
    pushAudit({
      action: 'admin.user.delete',
      entity: 'user',
      entityId: id,
      userId: auth.admin.id,
    });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, message: e instanceof Error ? e.message : 'Delete failed' },
      { status: 400 },
    );
  }
}
