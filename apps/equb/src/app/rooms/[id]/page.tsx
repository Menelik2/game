'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import { takenPicks, isFull } from '@/lib/equb-math';
import {
  isMultiplayerEnabled,
  joinRoom as mpJoin,
  openRoom,
  fetchRoom,
  drawRoom,
  getPlayerIdentity,
  type ServerRoom,
} from '@/lib/multiplayer';
import { optimisticJoin } from '@/lib/optimistic';
import { EqubBoard, EqubRulesCard, EqubResultBanner } from '@/components/EqubBoard';

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const multiplayer = isMultiplayerEnabled();

  const rooms = useEqubStore((s) => s.rooms);
  const ensureRooms = useEqubStore((s) => s.ensureRooms);
  const user = useEqubStore((s) => s.user);
  const joinLocal = useEqubStore((s) => s.joinRoom);
  const fillSeats = useEqubStore((s) => s.fillSeats);
  const runDraw = useEqubStore((s) => s.runDraw);
  const loginDemo = useEqubStore((s) => s.loginDemo);

  const [msg, setMsg] = useState('');
  const [pick, setPick] = useState<number | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [serverRoom, setServerRoom] = useState<ServerRoom | null>(null);

  const templateId = id?.match(/^equb-\d+-\d+/)?.[0] || id;

  const refreshServer = useCallback(async () => {
    if (!multiplayer || !id) return;
    try {
      if (serverRoom?.id) setServerRoom(await fetchRoom(serverRoom.id));
      else setServerRoom(await openRoom(templateId!));
    } catch {
      /* offline */
    }
  }, [multiplayer, id, templateId, serverRoom?.id]);

  useEffect(() => {
    if (!multiplayer) {
      ensureRooms();
      return;
    }
    void refreshServer();
    const t = setInterval(() => void refreshServer(), 2500);
    return () => clearInterval(t);
  }, [multiplayer, ensureRooms, refreshServer]);

  if (multiplayer) {
    const room = serverRoom;
    const identity = getPlayerIdentity();
    const taken = new Set(room?.members.map((m) => m.pick) || []);
    const yourPick =
      room?.members.find((m) => m.playerId === identity.playerId)?.pick ?? null;
    const inRoom = yourPick != null;
    const full = room ? room.members.length >= room.groupSize : false;
    const winner = room?.members.find((m) => m.playerId === room.winnerId);

    return (
      <div className="space-y-4">
        <button type="button" onClick={() => router.back()} className="text-sm text-white/40">
          ← Rooms
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="keno-title">FAST EQUB</h1>
            <p className="text-[11px] text-white/40">Pick 1 · computer draws · one winner</p>
          </div>
          {room && (
            <div className="text-right">
              <p className="text-[10px] text-white/40">Pot</p>
              <p className="font-mono text-sm font-bold text-gold-400">
                {room.prizePool.toLocaleString()}
              </p>
            </div>
          )}
        </div>
        <p className="rounded-xl border border-equb-500/25 bg-equb-500/10 px-3 py-2 text-[11px] text-equb-300">
          LIVE multiplayer
        </p>
        {!room ? (
          <p className="py-8 text-center text-white/40">Connecting…</p>
        ) : (
          <>
            <div className="glass rounded-2xl p-4">
              <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-white/50">
                <span>
                  Seats{' '}
                  <b className="text-white">
                    {room.members.length}/{room.groupSize}
                  </b>
                </span>
                <span>
                  Entry <b className="text-equb-400">{room.contribution}</b>
                </span>
                <span className="uppercase">{room.status}</span>
              </div>
              {room.status === 'completed' && room.winningNumber != null && (
                <div className="mb-4">
                  <EqubResultBanner
                    winningNumber={room.winningNumber}
                    winnerName={winner?.name || '—'}
                    prizePool={room.prizePool}
                    wasYou={winner?.playerId === identity.playerId}
                  />
                </div>
              )}
              <EqubBoard
                groupSize={room.groupSize}
                taken={taken}
                selected={pick}
                winningNumber={room.winningNumber}
                yourPick={yourPick}
                disabled={inRoom || room.status !== 'open' || joining}
                onSelect={setPick}
              />
            </div>
            <EqubRulesCard
              groupSize={room.groupSize}
              contribution={room.contribution}
              prizePool={room.prizePool}
            />
            {msg && <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-equb-300">{msg}</p>}
            {room.status === 'open' && !inRoom && (
              <button
                type="button"
                disabled={pick == null || joining}
                onClick={async () => {
                  if (pick == null) return;
                  setJoining(true);
                  setServerRoom(optimisticJoin(room, pick));
                  try {
                    setServerRoom(await mpJoin(templateId!, pick));
                    setMsg(`Joined #${String(pick).padStart(2, '0')}`);
                  } catch (e: any) {
                    setMsg(e?.message || 'Join failed');
                    void refreshServer();
                  } finally {
                    setJoining(false);
                  }
                }}
                className="w-full rounded-2xl bg-gold-500 py-3.5 text-sm font-black text-black disabled:opacity-40"
              >
                {joining ? 'JOINING…' : 'CONFIRM PICK · JOIN'}
              </button>
            )}
            {inRoom && full && room.status === 'open' && (
              <button
                type="button"
                disabled={drawing}
                onClick={async () => {
                  setDrawing(true);
                  try {
                    setServerRoom(await drawRoom(room.id));
                  } catch (e: any) {
                    setMsg(e?.message || 'Draw failed');
                  } finally {
                    setDrawing(false);
                  }
                }}
                className="w-full rounded-2xl bg-equb-500 py-3.5 text-sm font-black disabled:opacity-40"
              >
                {drawing ? 'DRAWING…' : 'RUN CRYPTO DRAW'}
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const room = rooms.find((r) => r.id === id);
  if (!room) {
    return (
      <div className="py-12 text-center text-white/50">
        Room not found. <Link href="/rooms" className="text-equb-400">Back</Link>
      </div>
    );
  }

  const taken = takenPicks(room);
  const yourPick = user ? room.members.find((m) => m.id === user.id)?.pick ?? null : null;
  const inRoom = yourPick != null;
  const full = isFull(room);
  const winner = room.members.find((m) => m.id === room.winnerId);

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => router.back()} className="text-sm text-white/40">
        ← Rooms
      </button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="keno-title">FAST EQUB</h1>
          <p className="text-[11px] text-white/40">Pick 1 · computer draws · one winner</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/40">Balance</p>
          <p className="font-mono text-sm font-bold text-equb-400">
            {user ? user.balance.toLocaleString() : '—'}
          </p>
        </div>
      </div>
      <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/45">
        DEMO · bots on this device · virtual Birr only
      </p>
      <div className="glass rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-white/50">
          <span>
            Seats{' '}
            <b className="text-white">
              {room.members.length}/{room.groupSize}
            </b>
          </span>
          <span>
            Entry <b className="text-equb-400">{room.contribution}</b>
          </span>
          <span>
            Pot <b className="text-gold-400">{room.prizePool.toLocaleString()}</b>
          </span>
        </div>
        {room.status === 'completed' && room.winningNumber != null && (
          <div className="mb-4">
            <EqubResultBanner
              winningNumber={room.winningNumber}
              winnerName={winner?.name || '—'}
              prizePool={room.prizePool}
              wasYou={!!(user && winner?.id === user.id)}
            />
          </div>
        )}
        <EqubBoard
          groupSize={room.groupSize}
          taken={taken}
          selected={pick}
          winningNumber={room.winningNumber}
          yourPick={yourPick}
          disabled={inRoom || room.status !== 'open'}
          onSelect={setPick}
        />
      </div>
      <EqubRulesCard
        groupSize={room.groupSize}
        contribution={room.contribution}
        prizePool={room.prizePool}
      />
      {msg && <p className="rounded-xl bg-white/5 px-3 py-2 text-xs text-equb-300">{msg}</p>}
      <div className="space-y-2">
        {!user && (
          <button
            type="button"
            onClick={() => loginDemo()}
            className="w-full rounded-2xl bg-equb-600 py-3.5 text-sm font-black"
          >
            SIGN IN · 5,000 DEMO BIRR
          </button>
        )}
        {user && !inRoom && room.status === 'open' && (
          <button
            type="button"
            disabled={pick == null}
            onClick={() => pick != null && setMsg(joinLocal(room.id, pick).message)}
            className="w-full rounded-2xl bg-gold-500 py-3.5 text-sm font-black text-black disabled:opacity-40"
          >
            CONFIRM PICK · JOIN
          </button>
        )}
        {inRoom && !full && room.status === 'open' && (
          <button
            type="button"
            onClick={() => setMsg(fillSeats(room.id).message)}
            className="w-full rounded-2xl border border-equb-500/40 py-3 text-sm font-semibold text-equb-300"
          >
            FILL SEATS WITH BOTS
          </button>
        )}
        {inRoom && full && room.status === 'open' && (
          <button
            type="button"
            disabled={drawing}
            onClick={async () => {
              setDrawing(true);
              setMsg((await runDraw(room.id)).message);
              setDrawing(false);
            }}
            className="w-full rounded-2xl bg-equb-500 py-3.5 text-sm font-black disabled:opacity-40"
          >
            {drawing ? 'DRAWING…' : 'RUN CRYPTO DRAW'}
          </button>
        )}
      </div>
    </div>
  );
}
