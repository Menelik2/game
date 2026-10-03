'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/equb-store';
import { GROUP_SIZES, contributionOf, roomIdOf } from '@/lib/equb-logic';

const PRIZES = [500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];

export default function RoomsPage() {
  const {
    user,
    rooms,
    lang,
    live,
    liveRoomIds,
    joinRoom,
    fillAndDraw,
    resetRoom,
    refreshLive,
    syncLiveRoom,
  } = useEqubStore();
  const [groupSize, setGroupSize] = useState(10);
  const [prize, setPrize] = useState(500);
  const [pick, setPick] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const t = (am: string, en: string) => (lang === 'am' ? am : en);

  const templateId = roomIdOf(groupSize, prize);
  const room = useMemo(() => rooms.find((r) => r.id === templateId), [rooms, templateId]);
  const contribution = contributionOf(prize, groupSize);
  const taken = new Set(room?.members.map((m) => m.pick) || []);
  const myPick = room?.members.find((m) => m.playerId === user?.playerId)?.pick;
  const instanceId = liveRoomIds[templateId];

  // Detect Nest API + poll active room
  useEffect(() => {
    refreshLive();
    const id = setInterval(() => {
      refreshLive();
      if (instanceId || myPick) syncLiveRoom(templateId);
    }, 3000);
    return () => clearInterval(id);
  }, [templateId, instanceId, myPick, refreshLive, syncLiveRoom]);

  const onJoin = async () => {
    setMsg('');
    if (!user) {
      setMsg(t('መጀመሪያ ይመዝገቡ', 'Register first'));
      return;
    }
    if (pick == null) {
      setMsg(t('ቁጥር ይምረጡ', 'Pick a number'));
      return;
    }
    setBusy(true);
    const res = await joinRoom(groupSize, prize, pick);
    setBusy(false);
    if (!res.ok) setMsg(res.error);
    else
      setMsg(
        live || useEqubStore.getState().live
          ? t('ተቀላቅለዋል · ላይቭ ሰርቨር', 'Joined · live server')
          : t('ተቀላቅለዋል · ኦፍላይን', 'Joined · offline'),
      );
  };

  const onDraw = async () => {
    setMsg('');
    setBusy(true);
    const res = await fillAndDraw(templateId);
    setBusy(false);
    if (!res.ok) setMsg(res.error);
    else {
      const won = res.room.winnerId === user?.playerId;
      setMsg(
        won
          ? t(`አሸንፈዋል! +${res.room.prizePool}`, `You won! +${res.room.prizePool}`)
          : t(
              `ዕጣ #${res.room.winningNumber} — አልተመረጡም`,
              `Draw #${res.room.winningNumber} — not this time`,
            ),
      );
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-white/60">{t('ለመጫወት መጀመሪያ ይመዝገቡ', 'Register to play')}</p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-xl bg-amber-400 px-6 py-3 font-bold text-black"
        >
          {t('ወደ መገለጫ', 'Go to profile')}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1.4fr_0.9fr]">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-emerald-200">{t('ፋስት እቁብ', 'Fast Equb')}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              live
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-white/10 text-white/40'
            }`}
          >
            {live ? t('ላይቭ API', 'LIVE API') : t('ኦፍላይን', 'OFFLINE')}
          </span>
        </div>
        <p className="text-sm text-white/45">
          {t('መጠን ምረጥ · ቁጥር ምረጥ · ዕጣ አድርግ', 'Pick size · pick number · draw')}
          {instanceId && (
            <span className="ml-2 font-mono text-[10px] text-white/25">
              {instanceId.slice(0, 28)}…
            </span>
          )}
        </p>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs">
              1
            </span>
            {t('በስንት መቀመጫ ተጫዋቾች', 'How many seats')}
          </div>
          <div className="flex flex-wrap gap-2">
            {GROUP_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setGroupSize(s);
                  setPick(null);
                  setMsg('');
                }}
                className={`h-10 min-w-10 rounded-full px-3 text-sm font-semibold ${
                  groupSize === s
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs">
              2
            </span>
            {t(
              `የእርስዎ ቁጥር — ከ 01 እስከ ${String(groupSize).padStart(2, '0')}`,
              `Your number — 01 to ${String(groupSize).padStart(2, '0')}`,
            )}
          </div>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
            {Array.from({ length: groupSize }, (_, i) => i + 1).map((n) => {
              const isTaken = taken.has(n) && myPick !== n;
              const isMine = myPick === n || pick === n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={isTaken || room?.status === 'completed' || !!myPick}
                  onClick={() => setPick(n)}
                  className={`rounded-xl py-3 text-sm font-bold tabular-nums ${
                    isMine
                      ? 'bg-emerald-500 text-black'
                      : isTaken
                        ? 'cursor-not-allowed bg-white/5 text-white/25'
                        : 'bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  {String(n).padStart(2, '0')}
                </button>
              );
            })}
          </div>
          {room && room.members.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/50">
              {room.members.map((m) => (
                <span
                  key={m.playerId}
                  className={`rounded-full px-2 py-0.5 ${
                    m.playerId === user.playerId
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-white/5'
                  }`}
                >
                  #{m.pick} {m.name}
                  {m.isBot ? ' · bot' : ''}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs">
              3
            </span>
            {t('የሽልማት ገንዘብ', 'Prize pool')}
          </div>
          <div className="flex flex-wrap gap-2">
            {PRIZES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPrize(p);
                  setPick(null);
                  setMsg('');
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  prize === p
                    ? 'bg-amber-400 text-black'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                {p.toLocaleString()} {t('ብር', 'ETB')}
              </button>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl bg-black/30 p-4 text-center text-sm">
            <div>
              <div className="text-white/40">{t('አስተዋጽኦ', 'Stake')}</div>
              <div className="font-bold text-emerald-300">{contribution}</div>
            </div>
            <div>
              <div className="text-white/40">{t('ተጫዋቾች', 'Players')}</div>
              <div className="font-bold">
                {room?.members.length ?? 0}/{groupSize}
              </div>
            </div>
            <div>
              <div className="text-white/40">{t('ሽልማት', 'Prize')}</div>
              <div className="font-bold text-amber-300">{prize}</div>
            </div>
          </div>

          {msg && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
              {msg}
            </div>
          )}

          {room?.status === 'completed' && room.winningNumber != null && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              {t('አሸናፊ ቁጥር', 'Winning number')}:{' '}
              <strong className="text-amber-300">#{room.winningNumber}</strong>
              {room.winnerId === user.playerId && (
                <span className="ml-2 text-emerald-400">{t('እርስዎ!', 'You!')}</span>
              )}
              <button
                type="button"
                onClick={() => {
                  resetRoom(templateId);
                  setPick(null);
                  setMsg('');
                }}
                className="ml-3 text-xs text-white/50 underline"
              >
                {t('አዲስ ዙር', 'New round')}
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {!myPick && room?.status !== 'completed' && (
              <button
                type="button"
                disabled={busy}
                onClick={onJoin}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-bold disabled:opacity-50"
              >
                {t('ተቀላቀል', 'Join')} · {contribution} {t('ብር', 'ETB')}
              </button>
            )}
            {myPick && room?.status !== 'completed' && (
              <button
                type="button"
                disabled={busy}
                onClick={onDraw}
                className="flex-1 rounded-xl bg-amber-400 py-3 text-sm font-bold text-black disabled:opacity-50"
              >
                {t('ቦቶች ሙላ + ዕጣ', 'Fill bots + draw')}
              </button>
            )}
          </div>
        </section>
      </div>

      <aside className="space-y-2">
        <h2 className="text-sm font-semibold text-white/50">{t('ክፍት ክፍሎች', 'Open rooms')}</h2>
        {PRIZES.slice(0, 8).map((p) => {
          const id = roomIdOf(groupSize, p);
          const r = rooms.find((x) => x.id === id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPrize(p);
                setPick(null);
                setMsg('');
              }}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm ${
                prize === p
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div>
                <div className="font-semibold">
                  {groupSize} {t('ተጫዋቾች', 'players')}
                </div>
                <div className="text-amber-300">
                  {p.toLocaleString()} {t('ብር', 'ETB')}
                </div>
              </div>
              <div className="text-xs text-white/40">
                {r?.members.length ?? 0}/{groupSize} {t('ቀንድሮች', 'seats')}
              </div>
            </button>
          );
        })}
      </aside>
    </div>
  );
}
