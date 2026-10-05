import type { TableResult } from '@/components/EqubTable';

export function mergeRoundResults(
  history: Array<{ roomId: string; at: number; winningNumber: number; winnerName: string; amount: number }>,
  serverRoom: {
    id?: string;
    status?: string;
    winningNumber?: number | null;
    winnerName?: string | null;
    prizePool?: number;
    recent?: Array<{ id: string; winningNumber: number; winnerName: string; pot: number; at: number }>;
  } | null,
): TableResult[] {
  const live: TableResult[] = (serverRoom?.recent || []).map((r) => ({
    id: r.id,
    winningNumber: r.winningNumber,
    winnerName: r.winnerName,
    pot: r.pot,
    at: r.at,
  }));
  if (serverRoom?.status === 'completed' && serverRoom.winningNumber && serverRoom.winnerName) {
    const current: TableResult = {
      id: `now-${serverRoom.id}`,
      winningNumber: serverRoom.winningNumber,
      winnerName: serverRoom.winnerName,
      pot: Number(serverRoom.prizePool || 0),
      at: Date.now(),
    };
    if (!live.some((r) => r.winnerName === current.winnerName && r.winningNumber === current.winningNumber)) {
      live.unshift(current);
    }
  }
  const local = history.slice(0, 12).map((h, i) => ({
    id: `${h.roomId}-${h.at}-${i}`,
    winningNumber: h.winningNumber,
    winnerName: h.winnerName,
    pot: h.amount,
    at: h.at,
  }));
  return [...live, ...local].slice(0, 12);
}
