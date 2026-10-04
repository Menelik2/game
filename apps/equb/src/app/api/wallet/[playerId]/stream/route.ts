import { NextRequest } from 'next/server';
import { ensureWallet, subscribe } from '@/lib/server/wallets';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ playerId: string }> },
) {
  const { playerId: raw } = await ctx.params;
  const playerId = decodeURIComponent(raw);
  const w = ensureWallet(playerId);

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (obj: unknown) => {
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      send({ type: 'snapshot', data: w });
      const unsub = subscribe(playerId, (ev) => send(ev));
      const hb = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: ping\n\n`));
        } catch {
          clearInterval(hb);
          unsub();
        }
      }, 15000);
      req.signal.addEventListener('abort', () => {
        clearInterval(hb);
        unsub();
        try {
          controller.close();
        } catch {
          /* */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
