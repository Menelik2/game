'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useEqubStore } from '@/lib/equb-store';
import { GROUP_SIZES, contributionOf, roomIdOf } from '@/lib/equb-logic';

const POTS = [500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000];

type Step = 1 | 2 | 3;

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

  const [step, setStep] = useState<Step>(1);
  const [groupSize, setGroupSize] = useState<number | null>(null);
  const [prize, setPrize] = useState<number | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const t = (am: string, en: string) => (lang === 'am' ? am : en);

  const size = groupSize ?? 10;
  const pot = prize ?? 500;
  const templateId = roomIdOf(size, pot);
  const room = useMemo(() => rooms.find((r) => r.id === templateId), [rooms, templateId]);
  const contribution = contributionOf(pot, size);
  const taken = new Set(room?.members.map((m) => m.pick) || []);
  const myPick = room?.members.find((m) => m.playerId === user?.playerId)?.pick;
  const instanceId = liveRoomIds[templateId];

  const openRooms = useMemo(() => {
    return rooms
      .filter(
        (r) =>
          r.members.length > 0 &&
          r.status !== 'completed' &&
          r.members.length < r.groupSize,
      )
      .sort((a, b) => b.members.length - a.members.length)
      .slice(0, 12);
  }, [rooms]);

  useEffect(() => {
    refreshLive();
    const id = setInterval(() => {
      refreshLive();
      if (instanceId || myPick) syncLiveRoom(templateId);
    }, 3000);
    return () => clearInterval(id);
  }, [templateId, instanceId, myPick, refreshLive, syncLiveRoom]);

  useEffect(() => {
    if (myPick && step < 3) {
      setPick(myPick);
      setStep(3);
    }
  }, [myPick, step]);

  const goStep1 = () => {
    setStep(1);
    setGroupSize(null);
    setPick(null);
    setPrize(null);
    setMsg('');
  };

  const onSelectSize = (s: number) => {
    setGroupSize(s);
    setPick(null);
    setPrize(null);
    setMsg('');
    setStep(2);
  };

  const onSelectNumber = (n: number) => {
    setPick(n);
    setMsg('');
    setStep(3);
  };

  const joinOpenRoom = (r: (typeof rooms)[0]) => {
    setGroupSize(r.groupSize);
    setPrize(r.prizePool);
    setPick(null);
    setMsg('');
    setStep(2);
  };

  const onJoin = async () => {
    setMsg('');
    if (!user) {
      setMsg(t('መጀመሪያ ይመዝገቡ', 'Register first'));
      return;
    }
    if (groupSize == null || pick == null || prize == null) {
      setMsg(t('ሁሉንም ደረጃዎች ይምረጡ', 'Complete all steps'));
      return;
    }
    setBusy(true);
    const res = await joinRoom(groupSize, prize, pick);
    setBusy(false);
    if (!res.ok) setMsg(res.error);
    else setMsg(t('ወደ ክበቡ ተቀላቅለዋል (ዲሞ)', 'Joined the circle (demo)'));
  };

  const onDraw = async () => {
    setMsg('');
    setBusy(true);
    const res = await fillAndDraw(templateId);
    setBusy(false);
    if (!res.ok) setMsg(res.error);
    else {
      const received = res.room.winnerId === user?.playerId;
      setMsg(
        received
          ? t(`እርስዎ ተቀብለዋል · +${res.room.prizePool} ብር`, `You receive the pot · +${res.room.prizePool} ETB`)
          : t(
              `ተቀባይ ቁጥር #${res.room.winningNumber} — በዚህ ዙር አይደለም`,
              `Receiver number #${res.room.winningNumber} — not this cycle`,
            ),
      );
    }
  };

  const onNewRound = () => {
    resetRoom(templateId);
    setPick(null);
    setPrize(null);
    setMsg('');
    setStep(groupSize ? 2 : 1);
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-white/60">{t('ለመቀላቀል መጀመሪያ ስምዎን ያስገቡ', 'Enter your name to join a circle')}</p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-xl bg-amber-400 px-6 py-3 font-bold text-black"
        >
          {t('ወደ መገለጫ', 'Go to profile')}
        </Link>
      </div>
    );
  }

  const stepLabel = (n: Step, am: string, en: string, done: boolean, active: boolean) => (
    <button
      type="button"
      onClick={() => {
        if (done || active) setStep(n);
      }}
      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'bg-emerald-600 text-white'
          : done
            ? 'bg-emerald-500/20 text-emerald-300'
            : 'bg-white/5 text-white/35'
      }`}
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/20 text-[10px]">
        {done && !active ? '✓' : n}
      </span>
      {t(am, en)}
    </button>
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-emerald-200">{t('እቁብ ክበቦች', 'Equb circles')}</h1>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-white/40">
          {t('ዲሞ', 'DEMO')}
        </span>
      </div>
      <p className="mt-1 text-sm text-white/45">
        {t('ደረጃ በደረጃ ወደ ክበብ ይግቡ', 'Join a circle step by step')}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {stepLabel(1, 'አባላት', 'Members', groupSize != null, step === 1)}
        {stepLabel(2, 'ተራዎ', 'Your turn', pick != null || !!myPick, step === 2)}
        {stepLabel(3, 'መዋጮ', 'Contribution', prize != null, step === 3)}
      </div>

      {groupSize != null && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/50">
          <span className="rounded-full bg-white/5 px-2.5 py-1">
            {groupSize} {t('አባላት', 'members')}
          </span>
          {(pick != null || myPick) && (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
              #{String(myPick ?? pick).padStart(2, '0')}
            </span>
          )}
          {prize != null && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-amber-300">
              {prize.toLocaleString()} {t('ብር', 'ETB')}
            </span>
          )}
          {step > 1 && !myPick && room?.status !== 'completed' && (
            <button type="button" onClick={goStep1} className="text-white/35 underline">
              {t('እንደገና ጀምር', 'Start over')}
            </button>
          )}
        </div>
      )}

      {step === 1 && (
        <>
          <section className="mt-6 rounded-2xl border border-emerald-900/40 bg-emerald-950/30 p-5">
            <div className="mb-1 flex items-center gap-2 text-base font-bold text-emerald-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm">
                1
              </span>
              {t('በክበቡ ውስጥ ስንት አባላት?', 'How many members in the circle?')}
            </div>
            <p className="mb-4 text-sm text-white/45">
              {t('የአባላት ብዛት ይምረጡ', 'Choose how many people save together')}
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {GROUP_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSelectSize(s)}
                  className={`rounded-2xl py-4 text-lg font-bold transition ${
                    groupSize === s
                      ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                      : 'bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="mb-3 text-sm font-semibold text-white/60">
              {t('ክፍት ክበቦች', 'Open circles')}
            </h2>
            {openRooms.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/40">
                {t(
                  'አሁን ክፍት ክበብ የለም — ከላይ አባላትን ይምረጡ እና አዲስ ይጀምሩ',
                  'No open circles yet — pick members above to start a new one',
                )}
              </div>
            ) : (
              <ul className="space-y-2">
                {openRooms.map((r) => {
                  const stake = contributionOf(r.prizePool, r.groupSize);
                  const seatsLeft = r.groupSize - r.members.length;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => joinOpenRoom(r)}
                        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-800/40 bg-emerald-950/40 px-4 py-3.5 text-left transition hover:border-emerald-500/50"
                      >
                        <div>
                          <div className="font-semibold text-emerald-100">
                            {r.groupSize} {t('አባላት', 'members')} ·{' '}
                            <span className="text-amber-300">
                              {r.prizePool.toLocaleString()} {t('ብር', 'ETB')}
                            </span>
                          </div>
                          <div className="mt-0.5 text-xs text-white/40">
                            {t('መዋጮ', 'Each pays')} {stake} · {seatsLeft}{' '}
                            {t('ቦታ ቀርቷል', 'places left')}
                          </div>
                        </div>
                        <div className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">
                          {r.members.length}/{r.groupSize}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {openRooms.length === 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs text-white/35">{t('ፈጣን ጅምር', 'Quick start')}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { size: 5, prize: 500 },
                    { size: 10, prize: 1000 },
                    { size: 10, prize: 500 },
                    { size: 20, prize: 2000 },
                  ].map((q) => (
                    <button
                      key={`${q.size}-${q.prize}`}
                      type="button"
                      onClick={() => {
                        setGroupSize(q.size);
                        setPrize(q.prize);
                        setPick(null);
                        setMsg('');
                        setStep(2);
                      }}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
                    >
                      {q.size} · {q.prize}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {step === 2 && groupSize != null && (
        <section className="mt-6 rounded-2xl border border-emerald-900/40 bg-emerald-950/30 p-5">
          <div className="mb-1 flex items-center gap-2 text-base font-bold text-emerald-200">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-sm">
              2
            </span>
            {t('የእርስዎ ተራ / ቁጥር', 'Your turn / number')}
          </div>
          <p className="mb-4 text-sm text-white/45">
            {t(
              `ከ 01 እስከ ${String(groupSize).padStart(2, '0')} ይምረጡ`,
              `Choose from 01 to ${String(groupSize).padStart(2, '0')}`,
            )}
          </p>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: groupSize }, (_, i) => i + 1).map((n) => {
              const isTaken = taken.has(n) && myPick !== n;
              const isMine = myPick === n || pick === n;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={isTaken || room?.status === 'completed' || !!myPick}
                  onClick={() => onSelectNumber(n)}
                  className={`rounded-xl py-3.5 text-sm font-bold tabular-nums transition ${
                    isMine
                      ? 'bg-emerald-500 text-black'
                      : isTaken
                        ? 'cursor-not-allowed bg-white/5 text-white/25'
                        : 'bg-white/5 text-white/85 hover:bg-emerald-500/30'
                  }`}
                >
                  {String(n).padStart(2, '0')}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setStep(1)} className="mt-4 text-xs text-white/40 underline">
            {t('← አባላት / ክፍት ክበቦች', '← Members / open circles')}
          </button>
        </section>
      )}

      {step === 3 && groupSize != null && (pick != null || myPick) && (
        <section className="mt-6 rounded-2xl border border-amber-900/30 bg-gradient-to-b from-amber-950/40 to-emerald-950/20 p-5">
          <div className="mb-1 flex items-center gap-2 text-base font-bold text-amber-200">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-sm text-black">
              3
            </span>
            {t('የክበቡ ገንዘብ (መዋጮ)', 'Circle pot (contribution)')}
          </div>
          <p className="mb-4 text-sm text-white/45">
            {t('ጠቅላላ ገንዘብ ይምረጡ — እያንዳንዱ አባል እኩል ያስገባል', 'Choose total pot — each member pays an equal share')}
          </p>

          {!myPick && (
            <div className="flex flex-wrap gap-2">
              {POTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrize(p)}
                  className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                    prize === p
                      ? 'bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                      : 'bg-white/5 text-white/75 hover:bg-white/10'
                  }`}
                >
                  {p.toLocaleString()}
                </button>
              ))}
            </div>
          )}

          {prize != null && (
            <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-black/30 p-4 text-center text-sm">
              <div>
                <div className="text-white/40">{t('የእርስዎ መዋጮ', 'Your share')}</div>
                <div className="font-bold text-emerald-300">{contribution}</div>
              </div>
              <div>
                <div className="text-white/40">{t('ተራ', 'Turn')}</div>
                <div className="font-bold">#{String(myPick ?? pick).padStart(2, '0')}</div>
              </div>
              <div>
                <div className="text-white/40">{t('ጠቅላላ', 'Total pot')}</div>
                <div className="font-bold text-amber-300">{prize.toLocaleString()}</div>
              </div>
            </div>
          )}

          {msg && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">{msg}</div>
          )}

          {room?.status === 'completed' && room.winningNumber != null && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              {t('ተቀባይ ቁጥር', 'Receiver number')}:{' '}
              <strong className="text-amber-300">#{room.winningNumber}</strong>
              {room.winnerId === user.playerId && (
                <span className="ml-2 text-emerald-400">{t('እርስዎ!', 'You!')}</span>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2">
            {!myPick && room?.status !== 'completed' && (
              <button
                type="button"
                disabled={busy || prize == null}
                onClick={onJoin}
                className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-bold text-black disabled:opacity-40"
              >
                {prize == null
                  ? t('መጀመሪያ መዋጮ ይምረጡ', 'Choose contribution first')
                  : `${t('ተቀላቀል', 'Contribute')} · ${contribution} ${t('ብር', 'ETB')}`}
              </button>
            )}
            {myPick && room?.status !== 'completed' && (
              <button
                type="button"
                disabled={busy}
                onClick={onDraw}
                className="w-full rounded-2xl bg-amber-400 py-4 text-base font-bold text-black disabled:opacity-50"
              >
                {t('ክበብ ሙላ (ዲሞ) + ተቀባይ ምረጥ', 'Fill circle (demo) + pick receiver')}
              </button>
            )}
            {room?.status === 'completed' && (
              <button
                type="button"
                onClick={onNewRound}
                className="w-full rounded-2xl border border-white/20 py-3 text-sm font-semibold"
              >
                {t('አዲስ ዙር', 'New cycle')}
              </button>
            )}
            {!myPick && (
              <button type="button" onClick={() => setStep(2)} className="text-xs text-white/40 underline">
                {t('← ተራ ቀይር', '← Change turn')}
              </button>
            )}
          </div>

          <p className="mt-4 text-center text-[11px] text-white/30">
            {t('ዲሞ — ምናባዊ ብር ብቻ። እውነተኛ ክፍያ የለም።', 'Demo — virtual birr only. No real payments.')}
          </p>
        </section>
      )}
    </div>
  );
}
