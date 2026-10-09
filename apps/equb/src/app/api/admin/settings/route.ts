import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import {
  getPlatformSettings,
  setPlatformSettings,
} from '@/lib/server/platform-settings';
import {
  getPrizeSettings,
  setPrizeSettings,
} from '@/lib/server/prize-settings';
import { pushAudit } from '@/lib/server/audit';
import {
  assertBodySize,
  originAllowed,
  forbiddenOrigin,
  withSecurityHeaders,
} from '@/lib/server/security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return withSecurityHeaders(auth.response);

  return withSecurityHeaders(
    NextResponse.json({
      success: true,
      data: {
        platform: getPlatformSettings(),
        prize: getPrizeSettings(),
      },
    }),
  );
}

export async function POST(req: NextRequest) {
  const tooBig = assertBodySize(req);
  if (tooBig) return withSecurityHeaders(tooBig);
  if (!originAllowed(req)) return withSecurityHeaders(forbiddenOrigin());

  const auth = await requireAdmin(req);
  if (!auth.ok) return withSecurityHeaders(auth.response);

  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const section = String(body.section || 'platform').trim();

    if (section === 'prize') {
      const rate =
        body.platformFeeRate !== undefined
          ? Number(body.platformFeeRate)
          : body.feePercent !== undefined
            ? Number(body.feePercent) / 100
            : undefined;
      if (rate === undefined || !Number.isFinite(rate)) {
        return withSecurityHeaders(
          NextResponse.json(
            { success: false, message: 'platformFeeRate or feePercent required' },
            { status: 400 },
          ),
        );
      }
      const prize = setPrizeSettings({
        platformFeeRate: rate,
        updatedBy: auth.admin.id,
      });
      pushAudit({
        action: 'settings.prize_fee',
        entity: 'prize_settings',
        userId: auth.admin.id,
        meta: { platformFeeRate: prize.platformFeeRate },
      });
      return withSecurityHeaders(
        NextResponse.json({
          success: true,
          message: `Platform fee set to ${(prize.platformFeeRate * 100).toFixed(1)}%`,
          data: { prize, platform: getPlatformSettings() },
        }),
      );
    }

    // platform section
    const platform = setPlatformSettings({
      maintenanceMode:
        body.maintenanceMode !== undefined
          ? Boolean(body.maintenanceMode)
          : undefined,
      maintenanceMessage:
        body.maintenanceMessage !== undefined
          ? String(body.maintenanceMessage)
          : undefined,
      announcementEnabled:
        body.announcementEnabled !== undefined
          ? Boolean(body.announcementEnabled)
          : undefined,
      announcement:
        body.announcement !== undefined ? String(body.announcement) : undefined,
      supportPhone:
        body.supportPhone !== undefined ? String(body.supportPhone) : undefined,
      supportName:
        body.supportName !== undefined ? String(body.supportName) : undefined,
      minDepositEtb:
        body.minDepositEtb !== undefined
          ? Number(body.minDepositEtb)
          : undefined,
      maxDepositEtb:
        body.maxDepositEtb !== undefined
          ? Number(body.maxDepositEtb)
          : undefined,
      registrationOpen:
        body.registrationOpen !== undefined
          ? Boolean(body.registrationOpen)
          : undefined,
      newUserBonusEtb:
        body.newUserBonusEtb !== undefined
          ? Number(body.newUserBonusEtb)
          : undefined,
      updatedBy: auth.admin.id,
    });

    pushAudit({
      action: 'settings.platform_update',
      entity: 'platform_settings',
      userId: auth.admin.id,
      meta: {
        maintenanceMode: platform.maintenanceMode,
        announcementEnabled: platform.announcementEnabled,
        registrationOpen: platform.registrationOpen,
      },
    });

    return withSecurityHeaders(
      NextResponse.json({
        success: true,
        message: 'Settings saved',
        data: { platform, prize: getPrizeSettings() },
      }),
    );
  } catch (e: unknown) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: e instanceof Error ? e.message : 'Save failed',
        },
        { status: 500 },
      ),
    );
  }
}
