import { NextRequest, NextResponse } from 'next/server';
import { adminUpdate } from '@/lib/server/admin-users';
import { dbGetUser, isDbConfigured } from '@/lib/server/db-users';
import { hashPassword, normalizePhone } from '@/lib/password';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin, sanitizeText } from '@/lib/server/admin-auth';
import { pushAudit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Admin changes own login credentials — requires current admin session. */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    if (!isDbConfigured()) {
      return NextResponse.json(
        { success: false, message: 'Database not configured' },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const userId = auth.admin.id;

    const existing = await dbGetUser(userId);
    if (!existing || existing.role !== 'admin') {
      return NextResponse.json(
        { success: false, message: 'Only admins can use this endpoint' },
        { status: 403 },
      );
    }

    const currentPassword = String(body.currentPassword || '');
    if (!currentPassword) {
      return NextResponse.json(
        { success: false, message: 'Current password required' },
        { status: 400 },
      );
    }

    const { data } = await sb()
      .from('app_users')
      .select('password_hash')
      .eq('id', userId)
      .maybeSingle();
    if (data && String(data.password_hash) !== hashPassword(currentPassword)) {
      return NextResponse.json(
        { success: false, message: 'Current password is incorrect' },
        { status: 401 },
      );
    }

    const patch: { fullName?: string; phone?: string; password?: string } = {};

    if (body.fullName != null && String(body.fullName).trim()) {
      patch.fullName = sanitizeText(body.fullName, 80);
    }
    if (body.phone != null && String(body.phone).trim()) {
      const phone = normalizePhone(String(body.phone));
      if (!phone) {
        return NextResponse.json(
          { success: false, message: 'Invalid phone (use 09xxxxxxxx)' },
          { status: 400 },
        );
      }
      patch.phone = phone;
    }
    if (body.password != null && String(body.password).length > 0) {
      if (String(body.password).length < 6) {
        return NextResponse.json(
          { success: false, message: 'New password must be at least 6 characters' },
          { status: 400 },
        );
      }
      patch.password = String(body.password);
    }

    if (!patch.fullName && !patch.phone && !patch.password) {
      return NextResponse.json(
        { success: false, message: 'Nothing to update' },
        { status: 400 },
      );
    }

    const updated = await adminUpdate(userId, patch);
    pushAudit({
      action: 'admin.account.update',
      entity: 'user',
      entityId: userId,
      userId,
      meta: { keys: Object.keys(patch) },
    });

    return NextResponse.json({
      success: true,
      message: 'Login credentials updated in database',
      data: updated,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Update failed';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
