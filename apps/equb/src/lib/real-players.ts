/**
 * Real-player filters — demo, bot, and fake accounts never appear in
 * room lists, seat grids, or results (ውጤቶች).
 */

const FAKE_ID_PREFIXES = ['bot_', 'demo_', 'fake_', 'test_', 'anon_', 'guest_'];

const FAKE_NAME_RE =
  /^(bot(\s*\d+)?|demo(\s*user)?|test(\s*user)?|fake|guest|player\s*\d+|cpu|ai)$/i;

export function isFakePlayerId(id?: string | null): boolean {
  if (!id) return true;
  const s = String(id).trim().toLowerCase();
  if (!s) return true;
  return FAKE_ID_PREFIXES.some((p) => s.startsWith(p));
}

export function isFakePlayerName(name?: string | null): boolean {
  if (!name) return false;
  const n = String(name).trim();
  if (!n) return false;
  return FAKE_NAME_RE.test(n);
}

/** True for a real human player (UUID or phone-based id, real name). */
export function isRealPlayer(m: {
  id?: string;
  playerId?: string;
  name?: string;
  isBot?: boolean;
}): boolean {
  if (m.isBot === true) return false;
  const id = m.playerId || m.id || '';
  if (isFakePlayerId(id)) return false;
  if (isFakePlayerName(m.name)) return false;
  return true;
}

export function filterRealMembers<T extends { id?: string; playerId?: string; name?: string; isBot?: boolean }>(
  members: T[] | null | undefined,
): T[] {
  if (!members?.length) return [];
  return members.filter(isRealPlayer);
}

export function filterRealResults<
  T extends { winnerName?: string | null; winnerId?: string | null },
>(results: T[] | null | undefined): T[] {
  if (!results?.length) return [];
  return results.filter((r) => {
    if (r.winnerId && isFakePlayerId(r.winnerId)) return false;
    if (r.winnerName && isFakePlayerName(r.winnerName)) return false;
    // Drop empty / placeholder winners
    if (!r.winnerName || String(r.winnerName).trim() === '') return false;
    if (String(r.winnerName).toLowerCase() === 'player') return false;
    return true;
  });
}
