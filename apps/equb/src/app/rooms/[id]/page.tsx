'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  joinRoomWithBalance,
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
    const list =
      m.picks && m.picks.length
        ? m.picks
        : m.pick != null
          ? [m.pick]
          : [];
    for (const p of list) {
      const n = Number(p);
      if (Number.isFinite(n) && n > 0) s.add(n);
    }
  }
  return s;
}

function resolvePlayerId(storeUserId?: string | null): string {
  if (storeUserId) return String(storeUserId);
  return getPlayerIdentity().playerId;
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
  const runDraw = useEqubStore((s) => s.runDraw);
  const reopenRoom = useEqubStore((s) => s.reopenRoom);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
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
  const claimedRef = useRef<string | null>(null);
  const picksRef = useRef<number[]>([]);
  picksRef.current = picks;

  const applyServerBalance = useCallback(
    (balance: number) => {
      const u = useEqubStore.getState().user;
      if (!u) return;
      setSessionUser({ ...u, balance });
    },
    [setSessionUser],
  );

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
        .then((room) => setServerRoom(room))
        .catch(() => {});
    }, 3000);
    return () => clearInterval(iv);
  }, [multiplayer, templateId]);

  useDemoCountdown(tick, setTick, multiplayer && serverRoom?.secondsLeft != null);
  useEffect(() => {
    if (multiplayer && serverRoom?.secondsLeft != null) {
      setTick(Number(serverRoom.secondsLeft));
    }
  }, [multiplayer, serverRoom?.secondsLeft]);

  useEffect(() => {
    if (!multiplayer || !serverRoom || serverRoom.status !== 'completed' || !user)
      return;
    const playerId = resolvePlayerId(user.id);
    if (!serverRoom.winnerId || serverRoom.winnerId !== playerId) return;
    if (serverRoom.winningNumber == null) return;

    const key = `${serverRoom.id}-${serverRoom.winningNumber}-${serverRoom.winnerId}`;
    if (claimedRef.current === key) return;
    claimedRef.current = key;

    const split = splitPot(Number(serverRoom.prizePool || 0));
    const payout =
      typeof serverRoom.winnerPayout === 'number' && serverRoom.winnerPayout > 0
        ? serverRoom.winnerPayout
        : split.winnerPayout;

    (async () => {
      try {
        const res = await fetch('/api/equb/claim-win', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: playerId,
            templateId,
            roomId: serverRoom.id,
            winningNumber: serverRoom.winningNumber,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (typeof json.balance === 'number') applyServerBalance(json.balance);
        else refreshBalance();
        const amt = typeof json.amount === 'number' ? json.amount : payout;
        setMsg(
          locale === 'am'
            ? `አሸንፈዋል! +${amt} ብር ወደ ኪስ ተጨምሯል`
            : `You won! +${amt} Birr added to wallet`,
        );
      } catch {
        refreshBalance();
        setMsg(
          locale === 'am' ? `አሸንፈዋል! +${payout} ብር` : `You won! +${payout} Birr`,
        );
      }
    })();
  }, [
    multiplayer,
    serverRoom?.status,
    serverRoom?.id,
    serverRoom?.winnerId,
    serverRoom?.winningNumber,
    serverRoom?.prizePool,
    serverRoom?.winnerPayout,
    user,
    templateId,
    applyServerBalance,
    refreshBalance,
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

  function togglePick(n: number, groupSize: number, taken: Set<number>) {
    if (!Number.isFinite(n) || n < 1 || n > groupSize) return;
    if (taken.has(n)) {
      setMsg(locale === 'am' ? `ቁጥር ${n} ተይዟል` : `Number ${n} is taken`);
      return;
    }
    const max = maxPicksForGroup(groupSize);
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= max) {
        const next = [...prev.slice(1), n].sort((a, b) => a - b);
        setMsg(
          locale === 'am'
            ? `ከፍተኛ ${max} — የመጨረሻው ተመርጧል`
            : `Max ${max} — replaced oldest pick`,
        );
        return next;
      }
      setMsg('');
      return [...prev, n].sort((a, b) => a - b);
    });
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
    const playerId = resolvePlayerId(user?.id);
    const taken = allTaken(room);
    const me = room.members.find((m) => m.playerId === playerId);
    const yourPicks = me
      ? me.picks && me.picks.length
        ? me.picks
        : me.pick != null
          ? [me.pick]
          : []
      : [];
    const inRoom = yourPicks.length > 0;
    const maxP = maxPicksForGroup(room.groupSize);
    const displaySelected = inRoom ? yourPicks : picks;
    const players: TablePlayer[] = room.members.map((m) => ({
      id: m.playerId,
      name: m.name,
      pick: m.pick,
      picks:
        m.picks && m.picks.length
          ? m.picks
          : m.pick != null
            ? [m.pick]
            : [],
      isYou: m.playerId === playerId,
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
          {inRoom
            ? locale === 'am'
              ? `ተቀላቅለዋል · ቁጥሮችዎ: #${yourPicks.map((p) => String(p).padStart(2, '0')).join(' · #')}`
              : `Joined · your numbers: #${yourPicks.map((p) => String(p).padStart(2, '0')).join(' · #')}`
            : locale === 'am'
              ? `1) ቁጥር ይምረጡ (እስከ ${maxP})  2) BET ይጫኑ · እውነተኛ ተጫዋቾች ብቻ`
              : `1) Select numbers (up to ${maxP})  2) Press BET · real players only`}
        </p>
        {room.status === 'completed' && (room.winnerName || room.winnerId) && (
          <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-semibold text-amber-200">
            Winner: {room.winnerName || room.winnerId} · #
            {String(room.winningNumber).padStart(2, '0')}
            {room.winnerPayout != null ? ` · +${room.winnerPayout} Birr` : ''}
          </p>
        )}
        <EqubTable
          groupSize={room.groupSize}
          prizePool={room.prizePool}
          contribution={room.contribution}
          taken={taken}
          selected={displaySelected}
          yourPicks={yourPicks}
          winningNumber={room.winningNumber}
          status={room.status}
          players={players}
          results={historyResults}
          secondsLeft={Number(room.secondsLeft ?? tick)}
          roomId={room.id}
          lastAdminFee={room.adminFee}
          lastWinnerPayout={room.winnerPayout}
          disabled={inRoom || room.status !== 'open' || joining}
          joining={joining}
          canBet={
            room.status === 'open' && !inRoom && !joining && picks.length > 0
          }
          locale={locale}
          onToggleSelect={(n) => {
            if (inRoom || room.status !== 'open' || joining) return;
            togglePick(n, room.groupSize, taken);
          }}
          onBet={async () => {
            const current = picksRef.current;
            if (current.length === 0) {
              setMsg(
                locale === 'am'
                  ? 'ቢያንስ 1 ቁጥር ይምረጡ'
                  : 'Select at least one number',
              );
              return;
            }
            const check = validatePicks(room.groupSize, current, taken);
            if (!check.ok) {
              setMsg(check.message);
              return;
            }
            if (!user) {
              setMsg(t.common.signIn || 'Sign in first');
              return;
            }
            const fee =
              Math.round(
                Number(room.contribution || 0) * check.picks.length * 100,
              ) / 100;
            if (fee > 0 && user.balance < fee) {
              setMsg(
                locale === 'am'
                  ? `በቂ ብር የለም (ያስፈልጋል ${fee}) — ተሞላ`
                  : `Need ${fee} Birr — deposit to play`,
              );
              return;
            }
            setJoining(true);
            setServerRoom(optimisticJoin(room, check.picks));
            if (fee > 0) {
              applyServerBalance(Math.round((user.balance - fee) * 100) / 100);
            }
            try {
              const { room: joined, balance, fee: charged } =
                await joinRoomWithBalance(templateId!, check.picks);
              setServerRoom(joined);
              if (typeof balance === 'number') applyServerBalance(balance);
              else refreshBalance();
              setMsg(
                locale === 'am'
                  ? `ተቀላቅለዋል · #${check.picks.map((p) => String(p).padStart(2, '0')).join(' · #')} · -${charged ?? fee} ብር`
                  : `Joined · #${check.picks.map((p) => String(p).padStart(2, '0')).join(' · #')} · -${charged ?? fee} Birr`,
              );
              setPicks([]);
            } catch (e: unknown) {
              setMsg(e instanceof Error ? e.message : t.common.error);
              void refreshServer();
              refreshBalance();
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

  const room = rooms.find((r) => r.id === id || r.id === templateId);
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
  const players: TablePlayer[] = room.members
    .filter((m) => !m.isBot && !String(m.id).startsWith('bot_'))
    .map((m) => ({
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
        {inRoom
          ? locale === 'am'
            ? `ተቀላቅለዋል · #${yourPicks.map((p) => String(p).padStart(2, '0')).join(' · #')}`
            : `Joined · #${yourPicks.map((p) => String(p).padStart(2, '0')).join(' · #')}`
          : locale === 'am'
            ? `1) ቁጥር ይምረጡ (እስከ ${maxP})  2) BET · እውነተኛ ተጫዋቾች`
            : `1) Select numbers (up to ${maxP})  2) BET · real players only`}
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
        canFillBots={false}
        canDraw={inRoom && full && room.status === 'open'}
        locale={locale}
        onToggleSelect={(n) => {
          if (inRoom || room.status !== 'open') return;
          togglePick(n, room.groupSize, taken);
        }}
        onBet={() => {
          if (picks.length === 0) {
            setMsg(
              locale === 'am' ? 'ቁጥር ይምረጡ' : 'Select at least one number',
            );
            return;
          }
          if (!user) {
            setMsg(t.common.signIn || 'Sign in first');
            return;
          }
          const res = joinLocal(room.id, picks);
          setMsg(res.message);
          if (res.ok) setPicks([]);
        }}
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
