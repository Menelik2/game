import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server/admin-auth';
import { dbListUsers } from '@/lib/server/db-users';
import { getProfitAnalytics } from '@/lib/server/profit-ledger';
import { listAllSharedRooms } from '@/lib/server/shared-rooms-list';
import { listAudit } from '@/lib/server/audit';
import { isDbConfigured } from '@/lib/server/db-users';
import { withSecurityHeaders } from '@/lib/server/security';
import { getPlatformSettings } from '@/lib/server/platform-settings';
import { getPrizeSettings } from '@/lib/server/prize-settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return withSecurityHeaders(auth.response);

  try {
    const users = await dbListUsers().catch(() => []);
    const analytics = getProfitAnalytics();
    const rooms = isDbConfigured() ? await listAllSharedRooms().catch(() => []) : [];
    const audit = listAudit(15, 1);

    const players = users.filter((u) => u.role !== 'admin');
    const admins = users.filter((u) => u.role === 'admin');
    const banned = users.filter((u) => u.banned);
    const totalBalance = users.reduce((s, u) => s + Number(u.balance || 0), 0);

    const topBalances = [...users]
      .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
      .slice(0, 15)
      .map((u) => ({
        id: u.id,
        name: u.fullName,
        phone: u.phone,
        balance: Number(u.balance || 0),
        role: u.role,
        banned: Boolean(u.banned),
      }));

    const openRooms = rooms.filter((r) => r.status === 'open');
    const livePlayers = rooms.reduce(
      (n, r) => n + (r.members?.length || 0),
      0,
    );

    const recentWinners = (analytics.perGame || [])
      .filter((g) => g.winnerName)
      .slice(0, 20)
      .map((g) => ({
        roomId: g.roomId,
        templateId: g.templateId,
        winnerName: g.winnerName,
        winnerPayout: g.winnerPayout,
        adminFee: g.adminFee,
        winningNumber: g.winningNumber,
        completedAt: g.completedAt,
      }));

    return withSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          users: {
            total: users.length,
            players: players.length,
            admins: admins.length,
            banned: banned.length,
            totalBalance: Math.round(totalBalance * 100) / 100,
          },
          games: {
            liveRooms: rooms.length,
            openRooms: openRooms.length,
            livePlayers,
            completedTracked: analytics.total.games,
          },
          profit: {
            feePercent: analytics.feePercent,
            daily: analytics.daily,
            weekly: analytics.weekly,
            monthly: analytics.monthly,
            total: analytics.total,
            byTemplate: analytics.byTemplate?.slice(0, 10) || [],
          },
          topBalances,
          recentWinners,
          recentAudit: audit.items,
          settings: {
            platform: getPlatformSettings(),
            prize: getPrizeSettings(),
          },
        },
      }),
    );
  } catch (e: unknown) {
    return withSecurityHeaders(
      NextResponse.json(
        {
          success: false,
          message: e instanceof Error ? e.message : 'Reports failed',
        },
        { status: 500 },
      ),
    );
  }
}
