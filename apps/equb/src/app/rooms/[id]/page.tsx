'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useEqubStore } from '@/lib/store';
import { takenPicks, isFull } from '@/lib/equb-math';
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
import { interpolate } from '@/lib/i18n/dictionaries';
import { EqubTable, type TablePlayer, type TableResult } from '@/components/EqubTable';
import { mergeRoundResults } from '@/lib/round-results';
import { useAutoCryptoDraw, useDemoCountdown } from '@/lib/use-auto-draw';

function PlayBackBar() {
  const { t } = useI18n();
  return (
    <div className="mb-2 flex items-center gap-2">
      <Link href="/rooms" className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
        <ArrowLeft className="h-3.5 w-3.5" />
        {t.common.back}
      </Link>
    </div>
  );
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
  const loginDemo = useEqubStore((s) => s.loginDemo);
  const adjustBalance = useEqubStore((s) => s.adjustBalance);
  const refreshBalance = useEqubStore((s) => s.refreshBalance);
  const [msg, setMsg] = useState('');
  const [pick, setPick] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [serverRoom, setServerRoom] = useState<ServerRoom | null>(null);
  const [tick, setTick] = useState(60);
  const [conn, setConn] = useState<Conn>(wantMp ? 'checking' : 'offline');
  const templateId = id?.match(/^equb-\d+-\d+/)?.[0] || id;
  const multiplayer = wantMp && conn === 'online';

  const refreshServer = useCallback(async () => {
    if (!wantMp || !id || conn === 'offline') return;
    try {
      if (serverRoom?.id) setServerRoom(await fetchRoom(serverRoom.id));
      else setServerRoom(await openRoom(templateId!));
      setConn('online');
    } catch {
      setConn('offline');
      setServerRoom(null);
    }
  }, [wantMp, id, templateId, serverRoom?.id, conn]);

  useEffect(() => {
    ensureRooms();
    refreshBalance();
    if (!wantMp) { setConn('offline'); return; }
    let cancelled = false;
    const hardTimeout = setTimeout(() => {
      if (!cancelled) setConn((c) => (c === 'checking' ? 'offline' : c));
    }, 5000);
    (async () => {
      try {
        const ok = await Promise.race([probeApi(), new Promise<boolean>((r) => setTimeout(() => r(false), 4500))]);
        if (cancelled) return;
        if (!ok) { setConn('offline'); return; }
        try {
          const room = await openRoom(templateId!);
          if (cancelled) return;
          setServerRoom(room);
          setConn('online');
        } catch { if (!cancelled) setConn('offline'); }
      } catch { if (!cancelled) setConn('offline'); }
    })();
    return () => { cancelled = true; clearTimeout(hardTimeout); };
  }, [wantMp, ensureRooms, templateId, refreshBalance]);

  useEffect(() => {
    if (!multiplayer || !serverRoom?.id) return;
    const iv = setInterval(() => {
      void fetchRoom(serverRoom.id).then(setServerRoom).catch(() => setConn('offline'));
    }, 3000);
    return () => clearInterval(iv);
  }, [multiplayer, serverRoom?.id]);

  useDemoCountdown(tick, setTick, multiplayer && serverRoom?.secondsLeft != null);
  useEffect(() => {
    if (multiplayer && serverRoom?.secondsLeft != null) setTick(Number(serverRoom.secondsLeft));
  }, [multiplayer, serverRoom?.secondsLeft]);

  useEffect(() => {
    if (!multiplayer || !serverRoom || serverRoom.status !== 'completed' || !user) return;
    const identity = getPlayerIdentity();
    if (serverRoom.winnerId !== identity.playerId) return;
    const key = `paid-${serverRoom.id}-${serverRoom.winningNumber}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;
    const payout = Math.round(Number(serverRoom.prizePool || 0) * 0.85 * 100) / 100;
    if (payout > 0) {
      adjustBalance(payout);
      setMsg(locale === 'am' ? `አሸንፈዋል! +${payout} ብር` : `You won! +${payout} Birr`);
      try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ }
    }
  }, [multiplayer, serverRoom?.status, serverRoom?.id, serverRoom?.winnerId, serverRoom?.winningNumber, serverRoom?.prizePool, user, adjustBalance, locale]);

  useAutoCryptoDraw({ roomId: id, tick, setTick, setMsg, setDrawing, enabled: !multiplayer && conn !== 'checking', locale });

  const historyResults: TableResult[] = useMemo(
    () => mergeRoundResults(history, serverRoom),
    [history, serverRoom],
  );

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
    const taken = new Set(room.members.map((m) => m.pick) || []);
    const yourPick = room.members.find((m) => m.playerId === identity.playerId)?.pick ?? null;
    const inRoom = yourPick != null;
    const players: TablePlayer[] = room.members.map((m) => ({
      id: m.playerId,
      name: m.name,
      pick: m.pick,
      isYou: m.playerId === identity.playerId,
      status: room.status === 'completed' ? (m.playerId === room.winnerId ? 'won' : 'lost') : 'waiting',
    }));
    return (
      <div className="space-y-2 pb-4">
        <PlayBackBar />
        {room.status === 'completed' && room.winnerName && (
          <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-semibold text-amber-200">
            Winner: {room.winnerName} · #{String(room.winningNumber).padStart(2, '0')}
          </p>
        )}
        <EqubTable
          groupSize={room.groupSize}
          prizePool={room.prizePool}
          contribution={room.contribution}
          taken={taken}
          selected={pick}
          yourPick={yourPick}
          winningNumber={room.winningNumber}
          status={room.status}
          players={players}
          results={historyResults}
          secondsLeft={Number(room.secondsLeft ?? tick)}
          roomId={room.id}
          disabled={inRoom || room.status !== 'open' || joining}
          joining={joining}
          canBet={room.status === 'open' && !inRoom && pick != null}
          locale={locale}
          onSelect={setPick}
          onBet={async () => {
            if (pick == null) { setMsg(interpolate(t.rooms.pickFirst, { size: room.groupSize })); return; }
            if (!user) { setMsg(t.common.signIn || 'Sign in first'); return; }
            const fee = Number(room.contribution || 0);
            if (fee > 0 && user.balance < fee) {
              setMsg(locale === 'am' ? `በቂ ብር የለም (ያስፈልጋል ${fee})` : `Need ${fee} Birr`);
              return;
            }
            setJoining(true);
            if (fee > 0) {
              const deb = adjustBalance(-fee);
              if (!deb.ok) { setMsg(deb.message); setJoining(false); return; }
            }
            setServerRoom(optimisticJoin(room, pick));
            try {
              const joined = await mpJoin(templateId!, pick);
              setServerRoom(joined);
              setMsg(`#${String(pick).padStart(2, '0')}`);
            } catch (e: any) {
              if (fee > 0) adjustBalance(fee);
              setMsg(e?.message || t.common.error);
              void refreshServer();
            } finally { setJoining(false); }
          }}
        />
        {msg && <p className="rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-equb-300">{msg}</p>}
      </div>
    );
  }

  const room = rooms.find((r) => r.id === id);
  if (!room) {
    return (
      <div className="space-y-4 py-8 text-center">
        <PlayBackBar />
        <p className="text-white/50">{t.play.roomNotFound}</p>
        <Link href="/rooms" className="text-equb-400 underline">{t.play.backToRooms}</Link>
      </div>
    );
  }
  const taken = takenPicks(room);
  const yourPick = user ? room.members.find((m) => m.id === user.id)?.pick ?? null : null;
  const inRoom = yourPick != null;
  const full = isFull(room);
  const players: TablePlayer[] = room.members.map((m) => ({
    id: m.id, name: m.name, pick: m.pick, isYou: !!(user && m.id === user.id),
    status: room.status === 'completed' ? (m.id === room.winnerId ? 'won' : 'lost') : 'waiting',
  }));
  return (
    <div className="space-y-2 pb-4">
      <PlayBackBar />
      {room.status === 'completed' && room.winnerName && (
        <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-semibold text-amber-200">Winner: {room.winnerName} · #{String(room.winningNumber).padStart(2, '0')}</p>
      )}
      <EqubTable
        groupSize={room.groupSize}
        prizePool={room.prizePool}
        contribution={room.contribution}
        taken={taken}
        selected={pick}
        yourPick={yourPick}
        winningNumber={room.winningNumber}
        status={room.status}
        players={players}
        results={historyResults}
        secondsLeft={tick}
        roomId={room.id}
        disabled={inRoom || room.status !== 'open'}
        joining={joining}
        drawing={drawing}
        canBet={room.status === 'open' && !inRoom && pick != null}
        canFillBots={inRoom && !full && room.status === 'open'}
        canDraw={inRoom && full && room.status === 'open'}
        locale={locale}
        onSelect={setPick}
        onBet={() => {
          if (pick == null) { setMsg(interpolate(t.rooms.pickFirst, { size: room.groupSize })); return; }
          if (!useEqubStore.getState().user) loginDemo();
          const res = joinLocal(room.id, pick);
          setMsg(res.message);
          if (res.ok) setPick(null);
        }}
        onFillBots={() => setMsg(fillSeats(room.id).message)}
        onDraw={async () => { setDrawing(true); setMsg((await runDraw(room.id)).message); setDrawing(false); }}
        onPlayAgain={() => { setMsg(reopenRoom(room.id).message); setPick(null); setTick(60); }}
      />
      {msg && <p className="rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-equb-300">{msg}</p>}
    </div>
  );
}
