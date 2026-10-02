'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/equb-store';
import { GROUP_SIZES, contributionOf } from '@/lib/equb-logic';

const PRIZES = [500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];

export default function RoomsPage() {
  const { user, rooms, lang, joinRoom, fillAndDraw, resetRoom } = useEqubStore();
  const [groupSize, setGroupSize] = useState(10);
  const [prize, setPrize] = useState(500);
  const [pick, setPick] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const t = (am: string, en: string) => (lang === 'am' ? am : en);

  const roomId = `equb-${groupSize}-${prize}`;
  const room = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId]);
  const contribution = contributionOf(prize, groupSize);
  const taken = new Set(room?.members.map((m) => m.pick) || []);
  const myPick = room?.members.find((m) => m.playerId === user?.playerId)?.pick;

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
    else setMsg(t('ተቀላቅለዋል!', 'Joined!'));
  };

  const onDraw = async () => {
    setMsg('');
    setBusy(true);
    const res = await fillAndDraw(roomId);
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
        <h1 className="text-2xl font-bold text-emerald-200">{t('ፋስት እቁብ', 'Fast Equb')}</h1>
        <p className="text-sm text-white/45">
          {t('መጠን ምረጥ · ቁጥር ምረጥ · ዕጣ አድርግ', 'Pick size · pick number · draw')}
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
            {t(`የእርስዎ ቁጥር — ከ 01 እስከ ${String(groupSize).padStart(2, '0')}`, `Your number — 01 to ${String(groupSize).padStart(2, '0')}`)}
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
                  resetRoom(roomId);
                  setPick(null);
                  setMsg('');
                }}
                className="ml-3 text-xs underline text-white/50"
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
          const id = `equb-${groupSize}-${p}`;
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
                <div className="text-amber-300">{p.toLocaleString()} {t('ብር', 'ETB')}</div>
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
