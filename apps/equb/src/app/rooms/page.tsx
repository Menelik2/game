'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import {
  GROUP_SIZES,
  contributionPerMember,
  roomId,
  maxPicksForGroup,
} from '@/lib/equb-math';
import {
  isMultiplayerEnabled,
  openRoom,
  joinRoom as mpJoin,
  setPlayerName,
  listLiveRooms,
  probeApi,
  type ServerRoom,
} from '@/lib/multiplayer';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { formatBirrCompact } from '@/lib/money';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SeatRing } from '@/components/SeatNodes';
import { NumberPickBoard } from '@/components/NumberPickBoard';
import clsx from 'clsx';
import {
  ChevronRight,
  ChevronLeft,
  Radio,
  Trophy,
  Users,
  Hash,
  Check,
} from 'lucide-react';

const PRIZES = [500, 1000, 2000, 5000, 9000];

type Step = 1 | 2;

export default function RoomsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const am = locale === 'am';
  const user = useEqubStore((s) => s.user);

  const [step, setStep] = useState<Step>(1);
  const [groupSize, setGroupSize] = useState<number | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [prize, setPrize] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [liveOpen, setLiveOpen] = useState<ServerRoom[]>([]);
  const [liveOk, setLiveOk] = useState(false);
  const multiplayer = isMultiplayerEnabled();

  const size = groupSize ?? 5;
  const maxPicks = maxPicksForGroup(size);
  const prizeVal = prize ?? 500;
  const contribution = useMemo(
    () => contributionPerMember(prizeVal, size),
    [prizeVal, size],
  );
  const templateId = roomId(size, prizeVal);

  const refreshLive = useCallback(async () => {
    if (!multiplayer) return;
    try {
      const ok = await probeApi();
      if (!ok) {
        setLiveOk(false);
        return;
      }
      setLiveOk(true);
      const roomsList = await listLiveRooms().catch(() => [] as ServerRoom[]);
      const open = (roomsList || [])
        .filter((r) => r.status === 'open')
        .sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));
      setLiveOpen(open);
    } catch {
      setLiveOk(false);
    }
  }, [multiplayer]);

  useEffect(() => {
    void refreshLive();
    const iv = setInterval(() => void refreshLive(), 3000);
    return () => clearInterval(iv);
  }, [refreshLive]);

  useEffect(() => {
    setPicks((prev) => prev.slice(0, maxPicks));
  }, [maxPicks]);

  function selectPlayers(g: number) {
    setGroupSize(g);
    setPicks([]);
    setPrize(null);
    setErr('');
    setStep(2);
  }

  async function handleJoin() {
    if (!user) {
      setErr(am ? 'መጀመሪያ ይግቡ' : 'Sign in first');
      router.push('/profile');
      return;
    }
    if (!groupSize) {
      setErr(am ? 'ተጫዋቾች ቁጥር ይምረጡ' : 'Select players');
      setStep(1);
      return;
    }
    if (picks.length === 0) {
      setErr(am ? 'ቁጥር ይምረጡ' : 'Pick numbers');
      return;
    }
    if (!prize) {
      setErr(am ? 'የብር መጠን ይምረጡ' : 'Select amount');
      return;
    }

    const feeNeed = Math.round(contribution * picks.length * 100) / 100;
    if (feeNeed > 0 && Number(user.balance || 0) < feeNeed) {
      setErr(
        am
          ? `በቂ ብር የለም (ያስፈልጋል ${feeNeed} ብር) — ወደ ኪስ ይሂዱ`
          : `Need ${feeNeed} Birr — open Wallet first`,
      );
      return;
    }

    setBusy(true);
    setErr('');
    const safety = setTimeout(() => setBusy(false), 12_000);

    try {
      setPlayerName(user.name || 'Player');
      await openRoom(templateId);
      await mpJoin(templateId, picks);
      router.push(
        `/rooms/${encodeURIComponent(templateId)}?picks=${picks.join(',')}`,
      );
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Join failed');
    } finally {
      clearTimeout(safety);
      setBusy(false);
    }
  }

  const liveWithPlayers = liveOpen.filter((r) => (r.members?.length || 0) > 0);
  const liveEmpty = liveOpen.filter((r) => (r.members?.length || 0) === 0);
  const liveDisplay = [...liveWithPlayers, ...liveEmpty].slice(0, 6);

  return (
    <div className="space-y-4 pb-24">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="keno-title text-xl sm:text-2xl">
            {am ? 'ጨዋታ ጀምር' : t.rooms?.title || 'Play'}
          </h1>
          <p className="mt-1 text-xs text-white/45">
            {am
              ? '1) ተጫዋቾች  2) ቁጥር + ብር'
              : '1) Players  2) Numbers + Birr'}
          </p>
        </div>
        <LanguageSwitcher />
      </div>

      <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/30 p-2">
        <button
          type="button"
          onClick={() => {
            setStep(1);
            setErr('');
          }}
          className={clsx(
            'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition',
            step === 1
              ? 'bg-equb-500 text-white shadow-md shadow-equb-500/30'
              : groupSize
                ? 'bg-equb-500/15 text-equb-200'
                : 'text-white/35',
          )}
        >
          {groupSize && step !== 1 ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Users className="h-3.5 w-3.5" />
          )}
          {am ? 'ተጫዋቾች' : 'Players'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (groupSize) {
              setStep(2);
              setErr('');
            }
          }}
          className={clsx(
            'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition',
            step === 2
              ? 'bg-equb-500 text-white shadow-md shadow-equb-500/30'
              : picks.length > 0 && prize
                ? 'bg-equb-500/15 text-equb-200'
                : 'text-white/35',
          )}
        >
          <Hash className="h-3.5 w-3.5" />
          {am ? 'ቁጥር + ብር' : 'Numbers + Birr'}
        </button>
      </div>

      {multiplayer && liveOk && liveDisplay.length > 0 && step === 1 && (
        <section className="animate-fade-up glass relative overflow-hidden rounded-2xl p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-equb-300">
            <Radio className="h-3 w-3 animate-pulse" />
            {am ? 'ቀጥታ ክፍሎች' : 'Live rooms'}
          </p>
          <div className="space-y-1.5">
            {liveDisplay.slice(0, 4).map((r) => {
              const filled = r.members?.length || r.playerCount || 0;
              const max = r.groupSize || r.maxPlayers || 5;
              return (
                <Link
                  key={r.id || r.templateId}
                  href={`/rooms/${encodeURIComponent(r.templateId || r.id)}`}
                  className="flex items-center justify-between rounded-xl border border-equb-500/25 bg-black/25 px-3 py-2 active:scale-[0.98]"
                >
                  <span className="text-sm font-semibold">
                    {max} · {formatBirrCompact(r.prizePool, locale)}
                  </span>
                  <SeatRing total={max} filledCount={filled} size="sm" />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="animate-fade-up glass space-y-3 rounded-2xl p-4">
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-equb-500/20 text-equb-300">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="text-base font-black text-white sm:text-lg">
              {am ? 'ስንት ተጫዋቾች?' : 'How many players?'}
            </h2>
            <p className="mt-1 text-xs text-white/50">
              {am
                ? 'የቡድን መጠን ይምረጡ · ቢያንስ 5 ሰዎች ያስፈልጋሉ'
                : 'Choose group size · at least 5 players needed'}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
            {GROUP_SIZES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => selectPlayers(g)}
                className={clsx(
                  'rounded-xl border py-2 text-sm font-bold transition active:scale-95 sm:py-2.5 sm:text-base',
                  groupSize === g
                    ? 'border-equb-400 bg-equb-500 text-white shadow-md shadow-equb-500/25'
                    : 'border-white/10 bg-black/30 text-white/80 hover:border-equb-500/40',
                )}
              >
                {g}
              </button>
            ))}
          </div>

          <p className="text-center text-[11px] text-white/35">
            {am
              ? 'ከመረጡ በኋላ ቁጥር እና ብር ይመርጣሉ'
              : 'Next: pick numbers and Birr amount'}
          </p>
        </section>
      )}

      {step === 2 && groupSize != null && (
        <div className="space-y-3">
          <section className="animate-fade-up glass space-y-3 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setErr('');
                }}
                className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {am ? 'ተመለስ' : 'Back'}
              </button>
              <div className="text-right">
                <p className="text-[10px] uppercase text-white/40">
                  {am ? 'ተጫዋቾች' : 'Players'}
                </p>
                <p className="font-mono text-sm font-bold text-equb-300">
                  {groupSize}
                </p>
              </div>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300">
                <Hash className="h-5 w-5" />
              </div>
              <h2 className="text-base font-black text-white sm:text-lg">
                {am ? 'ቁጥርዎን ይምረጡ' : 'Pick your numbers'}
              </h2>
              <p className="mt-1 text-xs text-white/50">
                {am
                  ? `ከ 1 እስከ ${groupSize} · ከፍተኛ ${maxPicks} ቁጥር`
                  : `From 1 to ${groupSize} · max ${maxPicks}`}
              </p>
            </div>

            <NumberPickBoard
              groupSize={groupSize}
              picks={picks}
              maxPicks={maxPicks}
              locale={locale}
              onToggle={(n) => {
                setPicks((prev) => {
                  if (prev.includes(n)) return prev.filter((x) => x !== n);
                  if (prev.length >= maxPicks) return prev;
                  return [...prev, n].sort((a, b) => a - b);
                });
              }}
              onClear={() => setPicks([])}
            />

            {picks.length > 0 && (
              <p className="text-center text-sm text-equb-200">
                {am ? 'የመረጡት' : 'Selected'}:{' '}
                <span className="font-mono font-bold">
                  {picks.map((n) => String(n).padStart(2, '0')).join(' · ')}
                </span>
              </p>
            )}
          </section>

          {picks.length > 0 && (
            <section className="animate-fade-up glass space-y-3 rounded-2xl p-4">
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300">
                  <Trophy className="h-5 w-5" />
                </div>
                <h2 className="text-base font-black text-white sm:text-lg">
                  {am ? 'በስንት ብር ይጫወታሉ?' : 'How much Birr?'}
                </h2>
                <p className="mt-1 text-xs text-white/50">
                  {am
                    ? 'የሽልማት / ጨዋታ መጠን ይምረጡ'
                    : 'Choose the prize amount'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                {PRIZES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPrize(p);
                      setErr('');
                    }}
                    className={clsx(
                      'rounded-xl border py-2.5 text-sm font-bold transition active:scale-95',
                      prize === p
                        ? 'border-gold-400 bg-gold-400 text-black shadow-md shadow-gold-500/25'
                        : 'border-white/10 bg-black/30 text-white/85 hover:border-gold-400/40',
                    )}
                  >
                    {formatBirrCompact(p, locale)}
                  </button>
                ))}
              </div>

              {prize != null && (
                <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">
                      {am ? 'መግቢያ (በ1 ቁጥር)' : 'Entry / number'}
                    </span>
                    <span className="font-mono font-bold text-cyan-200">
                      {formatBirrCompact(contribution, locale)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">
                      {am ? 'እርስዎ የሚከፍሉት' : 'You pay'}
                      <span className="ml-1 text-white/30">
                        ({picks.length} ×{' '}
                        {formatBirrCompact(contribution, locale)})
                      </span>
                    </span>
                    <span className="font-mono text-base font-black text-gold-300">
                      {formatBirrCompact(
                        Math.round(contribution * picks.length * 100) / 100,
                        locale,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">
                      {am ? 'ሽልማት' : 'Prize pool'}
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatBirrCompact(prize, locale)}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={!prize || busy}
                onClick={() => void handleJoin()}
                className="btn-gold relative flex w-full items-center justify-center gap-2 overflow-hidden py-3 text-base disabled:opacity-40"
              >
                {busy
                  ? '...'
                  : am
                    ? 'ጨዋታ ጀምር / ተቀላቀል'
                    : 'Join & play'}
                <ChevronRight className="h-5 w-5" />
              </button>
            </section>
          )}
        </div>
      )}

      {err && (
        <p className="animate-fade-up rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-200">
          {err}
        </p>
      )}
    </div>
  );
}
