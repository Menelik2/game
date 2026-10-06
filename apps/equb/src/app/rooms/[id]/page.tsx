'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEqubStore } from '@/lib/store';
import {
  takenPicks,
  isFull,
  splitPot,
  maxPicksForGroup,
  memberPicks,
  validatePicks,
} from '@/lib/equb-math';
import {
  isMultiplayerEnabled,
  joinRoom as mpJoin,
  openRoom,
  fetchRoom,
  getPlayerIdentity,
  probeApi,
  type ServerRoom,
} from '@/lib/multiplayer';
import { optimisticJoin } from '@/lib/optimistic';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { EqubTable, type TablePlayer, type TableResult } from '@/components/EqubTable';
import { mergeRoundResults } from '@/lib/round-results';
import { useAutoCryptoDraw, useDemoCountdown } from '@/lib/use-auto-draw';

function PlayBackBar() {
  const { t } = useI18n();
  return (
    <div className="mb-2 flex items-center gap-2">
      <Link
        href="/rooms"
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t.common.back}
      </Link>
    </div>
  );
}

function allTaken(room: ServerRoom): Set<number> {
  const s = new Set<number>();
  for (const m of room.members || []) {
    const list = m.picks && m.picks.length ? m.picks : m.pick != null ? [m.pick] : [];
    for (const p of list) if (Number.isFinite(p)) s.add(Number(p));
  }
  return s;
}

type Conn = 'checking' | 'online' | 'offline';

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const wantMp = isMultiplayerEnabled();
  const { t, locale } = useI18n();
  const rooms = useEqubStore((s) => s.rooms);
  const ensureRooms = useEqubStore((s) => s.ensureRooms);
  const user = useEqubStore((s) => s.user);
  const history = useEqubStore((s) => s.history);
  const joinLocal = useEqubStore((s) => s.joinRoom);
  const fillSeats = useEqubStore((s) => s.fillSeats);
  const runDraw = useEqubStore((s) => s.runDraw);
  const reopenRoom = useEqubStore((s) => s.reopenRoom);
  const adjustBalance = useEqubStore((s) => s.adjustBalance);
  const refreshBalance = useEqubStore((s) => s.refreshBalance);
  const [msg, setMsg] = useState('');
  const [picks, setPicks] = useState<number[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [serverRoom, setServerRoom] = useState<ServerRoom | null>(null);
  const [tick, setTick] = useState(60);
  const [conn, setConn] = useState<Conn>(wantMp ? 'checking' : 'offline');
  const templateId = id?.match(/^equb-\d+-\d+/)?.[0] || id;
  const multiplayer = wantMp && conn === 'online';

  const refreshServer = useCallback(async () => {
    if (!wantMp || !templateId || conn === 'offline') return;
    try {
      const room = await fetchRoom(templateId);
      setServerRoom(room);
      setConn('online');
    } catch {
      try {
        setServerRoom(await openRoom(templateId));
        setConn('online');
      } catch {
        setConn('offline');
        setServerRoom(null);
      }
    }
  }, [wantMp, templateId, conn]);

  useEffect(() => {
    ensureRooms();
    refreshBalance();
    if (!wantMp) {
      setConn('offline');
      return;
    }
    let cancelled = false;
    const hardTimeout = setTimeout(() => {
      if (!cancelled) setConn((c) => (c === 'checking' ? 'offline' : c));
    }, 5000);
    (async () => {
      try {
        const ok = await Promise.race([
          probeApi(),
          new Promise<boolean>((r) => setTimeout(() => r(false), 4500)),
        ]);
        if (cancelled) return;
        if (!ok) {
          setConn('offline');
          return;
        }
        try {
          let room: ServerRoom;
          try {
            room = await fetchRoom(templateId!);
          } catch {
            room = await openRoom(templateId!);
          }
          if (cancelled) return;
          setServerRoom(room);
          setConn('online');
        } catch {
          if (!cancelled) setConn('offline');
        }
      } catch {
        if (!cancelled) setConn('offline');
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(hardTimeout);
    };
  }, [wantMp, ensureRooms, templateId, refreshBalance]);

  useEffect(() => {
    if (!multiplayer || !templateId) return;
    const iv = setInterval(() => {
      void fetchRoom(templateId)
        .then(setServerRoom)
        .catch(() => {});
    }, 2500);
    return () => clearInterval(iv);
  }, [multiplayer, templateId]);

  useDemoCountdown(tick, setTick, multiplayer && serverRoom?.secondsLeft != null);
  useEffect(() => {
    if (multiplayer && serverRoom?.secondsLeft != null) {
      setTick(Number(serverRoom.secondsLeft));
    }
  }, [multiplayer, serverRoom?.secondsLeft]);

  useEffect(() => {
    if (!multiplayer || !serverRoom || serverRoom.status !== 'completed' || !user) return;
    const identity = getPlayerIdentity();
    if (!serverRoom.winnerId || serverRoom.winnerId !== identity.playerId) return;
    const key = `paid-${serverRoom.id}-${serverRoom.winningNumber}-${serverRoom.winnerId}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* ignore */
    }
    const split = splitPot(Number(serverRoom.prizePool || 0));
    const payout =
      typeof serverRoom.winnerPayout === 'number' && serverRoom.winnerPayout > 0
        ? serverRoom.winnerPayout
        : split.winnerPayout;
    if (payout <= 0) return;
    const res = adjustBalance(payout);
    if (res.ok) {
      setMsg(locale === 'am' ? `አሸንፈዋል! +${payout} ብር` : `You won! +${payout} Birr`);
      try {
        sessionStorage.setItem(key, '1');
      } catch {
        /* ignore */
      }
    }
  }, [
    multiplayer,
    serverRoom?.status,
    serverRoom?.id,
    serverRoom?.winnerId,
    serverRoom?.winningNumber,
    serverRoom?.prizePool,
    serverRoom?.winnerPayout,
    user,
    adjustBalance,
    locale,
  ]);

  useAutoCryptoDraw({
    roomId: id,
    tick,
    setTick,
    setMsg,
    setDrawing,
    enabled: !multiplayer && conn !== 'checking',
    locale,
  });

  const historyResults: TableResult[] = useMemo(
    () => mergeRoundResults(history, serverRoom),
    [history, serverRoom],
  );

  /** Multi-select: tap to add/remove; max = groupSize ÷ 5 */
  function togglePick(n: number, groupSize: number, taken: Set<number>) {
    if (taken.has(n)) {
      setMsg(locale === 'am' ? `ቁጥር ${n} ተይዟል` : `Number ${n} is taken`);
      return;
    }
    const max = maxPicksForGroup(groupSize);
    setPicks((prev) => {
      if (prev.includes(n)) {
        const next = prev.filter((x) => x !== n);
        return next;
      }
      if (prev.length >= max) {
        // Replace oldest pick so user can keep choosing (better UX than blocking)
        const next = [...prev.slice(1), n].sort((a, b) => a - b);
        return next;
      }
      return [...prev, n].sort((a, b) => a - b);
    });
    setMsg('');
  }

  if (conn === 'checking') {
    return (
      <div className="space-y-4 py-12 text-center">
        <PlayBackBar />
        <p className="text-white/40">{t.common.connecting}</p>
      </div>
    );
  }

  if (multiplayer && serverRoom) {
    const room = serverRoom;
    const identity = getPlayerIdentity();
    const taken = allTaken(room);
    const me = room.members.find((m) => m.playerId === identity.playerId);
    const yourPicks = me
      ? me.picks && me.picks.length
        ? me.picks
        : me.pick != null
          ? [me.pick]
          : []
      : [];
    const inRoom = yourPicks.length > 0;
    const maxP = maxPicksForGroup(room.groupSize);
    const players: TablePlayer[] = room.members.map((m) => ({
      id: m.playerId,
      name: m.name,
      pick: m.pick,
      picks: m.picks && m.picks.length ? m.picks : m.pick != null ? [m.pick] : [],
      isYou: m.playerId === identity.playerId,
      status:
        room.status === 'completed'
          ? m.playerId === room.winnerId
            ? 'won'
            : 'lost'
          : 'waiting',
    }));

    return (
      <div className="space-y-2 pb-4">
        <PlayBackBar />
        <p className="text-center text-[11px] text-equb-300">
          {locale === 'am'
            ? `እስከ ${maxP} ቁጥር ይምረጡ · ነፃ መቀመጫዎችን ይንኩ`
            : `Tap free seats · select up to ${maxP} number(s) (${room.groupSize}÷5)`}
        </p>
        {room.status === 'completed' && (room.winnerName || room.winnerId) && (
          <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-semibold text-amber-200">
            Winner: {room.winnerName || room.winnerId} · #
            {String(room.winningNumber).padStart(2, '0')}
          </p>
        )}
        <EqubTable
          groupSize={room.groupSize}
          prizePool={room.prizePool}
          contribution={room.contribution}
          taken={taken}
          selected={inRoom ? yourPicks : picks}
          yourPicks={yourPicks}
          winningNumber={room.winningNumber}
          status={room.status}
          players={players}
          results={historyResults}
          secondsLeft={Number(room.secondsLeft ?? tick)}
          roomId={room.id}
          lastAdminFee={room.adminFee}
          lastWinnerPayout={room.winnerPayout}
          disabled={inRoom || room.status !== 'open'}
          joining={joining}
          canBet={room.status === 'open' && !inRoom && picks.length > 0}
          locale={locale}
          onToggleSelect={(n) => {
            if (inRoom || room.status !== 'open' || joining) return;
            togglePick(n, room.groupSize, taken);
          }}
          onBet={async () => {
            if (picks.length === 0) {
              setMsg(locale === 'am' ? 'ቢያንስ 1 ቁጥር ይምረጡ' : 'Select at least one number');
              return;
            }
            const check = validatePicks(room.groupSize, picks, taken);
            if (!check.ok) {
              setMsg(check.message);
              return;
            }
            if (!user) {
              setMsg(t.common.signIn || 'Sign in first');
              return;
            }
            const fee =
              Math.round(Number(room.contribution || 0) * check.picks.length * 100) / 100;
            if (fee > 0 && user.balance < fee) {
              setMsg(
                locale === 'am'
                  ? `በቂ ብር የለም (ያስፈልጋል ${fee})`
                  : `Need ${fee} Birr for ${check.picks.length} number(s)`,
              );
              return;
            }
            setJoining(true);
            if (fee > 0) {
              const deb = adjustBalance(-fee);
              if (!deb.ok) {
                setMsg(deb.message);
                setJoining(false);
                return;
              }
            }
            setServerRoom(optimisticJoin(room, check.picks));
            try {
              const joined = await mpJoin(templateId!, check.picks);
              setServerRoom(joined);
              setMsg(
                `Joined · #${check.picks.map((p) => String(p).padStart(2, '0')).join(' · #')}`,
              );
              setPicks([]);
            } catch (e: unknown) {
              if (fee > 0) adjustBalance(fee);
              setMsg(e instanceof Error ? e.message : t.common.error);
              void refreshServer();
            } finally {
              setJoining(false);
            }
          }}
        />
        {msg && (
          <p className="rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-equb-300">
            {msg}
          </p>
        )}
      </div>
    );
  }

  const room = rooms.find((r) => r.id === id);
  if (!room) {
    return (
      <div className="space-y-4 py-8 text-center">
        <PlayBackBar />
        <p className="text-white/50">{t.play.roomNotFound}</p>
        <Link href="/rooms" className="text-equb-400 underline">
          {t.play.backToRooms}
        </Link>
      </div>
    );
  }
  const taken = takenPicks(room);
  const me = user ? room.members.find((m) => m.id === user.id) : null;
  const yourPicks = me ? memberPicks(me) : [];
  const inRoom = yourPicks.length > 0;
  const full = isFull(room);
  const maxP = maxPicksForGroup(room.groupSize);
  const players: TablePlayer[] = room.members.map((m) => ({
    id: m.id,
    name: m.name,
    pick: m.pick,
    picks: memberPicks(m),
    isYou: !!(user && m.id === user.id),
    status:
      room.status === 'completed'
        ? m.id === room.winnerId
          ? 'won'
          : 'lost'
        : 'waiting',
  }));

  return (
    <div className="space-y-2 pb-4">
      <PlayBackBar />
      <p className="text-center text-[11px] text-equb-300">
        {locale === 'am'
          ? `እስከ ${maxP} ቁጥር (${room.groupSize}÷5)`
          : `Select up to ${maxP} number(s) (${room.groupSize}÷5)`}
      </p>
      {room.status === 'completed' && room.winnerName && (
        <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-semibold text-amber-200">
          Winner: {room.winnerName} · #
          {String(room.winningNumber).padStart(2, '0')}
        </p>
      )}
      <EqubTable
        groupSize={room.groupSize}
        prizePool={room.prizePool}
        contribution={room.contribution}
        taken={taken}
        selected={inRoom ? yourPicks : picks}
        yourPicks={yourPicks}
        winningNumber={room.winningNumber}
        status={room.status}
        players={players}
        results={historyResults}
        secondsLeft={tick}
        roomId={room.id}
        lastAdminFee={room.lastAdminFee}
        lastWinnerPayout={room.lastWinnerPayout}
        disabled={inRoom || room.status !== 'open'}
        joining={joining}
        drawing={drawing}
        canBet={room.status === 'open' && !inRoom && picks.length > 0}
        canFillBots={inRoom && !full && room.status === 'open'}
        canDraw={inRoom && full && room.status === 'open'}
        locale={locale}
        onToggleSelect={(n) => {
          if (inRoom || room.status !== 'open') return;
          togglePick(n, room.groupSize, taken);
        }}
        onBet={() => {
          if (picks.length === 0) {
            setMsg(locale === 'am' ? 'ቁጥር ይምረጡ' : 'Select at least one number');
            return;
          }
          const res = joinLocal(room.id, picks);
          setMsg(res.message);
          if (res.ok) setPicks([]);
        }}
        onFillBots={() => setMsg(fillSeats(room.id).message)}
        onDraw={async () => {
          setDrawing(true);
          setMsg((await runDraw(room.id)).message);
          setDrawing(false);
        }}
        onPlayAgain={() => {
          setMsg(reopenRoom(room.id).message);
          setPicks([]);
          setTick(60);
        }}
      />
      {msg && (
        <p className="rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-equb-300">
          {msg}
        </p>
      )}
    </div>
  );
}
