import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, sanitizeText } from '@/lib/server/admin-auth';
import { getProfitAnalytics } from '@/lib/server/profit-ledger';
import {
  getPrizeSettings,
  setPrizeSettings,
} from '@/lib/server/prize-settings';
import { pushAudit } from '@/lib/server/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET — profit KPIs from live completed games */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const limit = Math.min(
    200,
    Number(req.nextUrl.searchParams.get('limit')) || 50,
  );
  const analytics = getProfitAnalytics({ limit });
  const settings = getPrizeSettings();

  return NextResponse.json({
    success: true,
    data: {
      settings,
      analytics,
      note:
        'Profits are platform fees (adminFee) from completed multiplayer games with at least one real player.',
    },
  });
}

/** PATCH — update platform fee rate (Prize Settings) */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    let rate = Number(body.platformFeeRate);
    // Accept percent 15 or fraction 0.15
    if (rate > 1) rate = rate / 100;
    if (!Number.isFinite(rate) || rate < 0 || rate > 0.5) {
      return NextResponse.json(
        {
          success: false,
          message: 'platformFeeRate must be between 0 and 0.5 (0%–50%)',
        },
        { status: 400 },
      );
    }

    const settings = setPrizeSettings({
      platformFeeRate: rate,
      updatedBy: auth.admin.id,
    });

    pushAudit({
      action: 'admin.prize_settings.update',
      entity: 'prize_settings',
      entityId: 'platform_fee',
      userId: auth.admin.id,
      meta: {
        platformFeeRate: settings.platformFeeRate,
        note: sanitizeText(body.note, 120) || undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Platform fee set to ${(settings.platformFeeRate * 100).toFixed(2)}%`,
      data: { settings, analytics: getProfitAnalytics({ limit: 30 }) },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: e instanceof Error ? e.message : 'Update failed',
      },
      { status: 400 },
    );
  }
}
