import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const limit = Math.min(
    100,
    Number(req.nextUrl.searchParams.get('limit')) || 50,
  );
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);

  // Inline empty audit list — no helper exports from this route module
  const items: Array<{
    id: string;
    action: string;
    entity: string | null;
    entityId: string | null;
    userId: string | null;
    createdAt: string;
  }> = [];

  return NextResponse.json({
    success: true,
    data: {
      items: items.slice(0, limit),
      total: 0,
      meta: { page, total: 0, totalPages: 1 },
    },
  });
}
