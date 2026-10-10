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

type Step = 1 | 2 | 3;

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
  const totalFee =
    Math.round(contribution * Math.max(picks.length, 1) * 100) / 100;
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

  function goStep1() {
    setStep(1);
    setErr('');
  }

  function selectPlayers(g: number) {
    setGroupSize(g);
    setPicks([]);
    setPrize(null);
    setErr('');
    setStep(2);
  }

  function goStep2() {
    if (!groupSize) {
      setErr(am ? 'መጀመሪያ ተጫዋቾች ቁጥር ይምረጡ' : 'Select player count first');
      return;
    }
    setStep(2);
    setErr('');
  }

  function goStep3() {
    if (picks.length === 0) {
      setErr(am ? 'ቢያንስ አንድ ቁጥር ይምረጡ' : 'Pick at least one number');
      return;
    }
    if (picks.length > maxPicks) {
      setErr(
        am ? `ከፍተኛ ${maxPicks} ቁጥር ብቻ` : `Max ${maxPicks} number(s)`,
      );
      return;
    }
    setStep(3);
    setErr('');
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
      setStep(2);
      return;
    }
    if (!prize) {
      setErr(am ? 'የብር መጠን ይምረጡ' : 'Select amount');
      setStep(3);
      return;
    }

    const feeNeed =
      Math.round(contribution * picks.length * 100) / 100;
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

  const steps = [
    { n: 1 as Step, label: am ? 'ተጫዋቾች' : 'Players', icon: Users },
    { n: 2 as Step, label: am ? 'ቁጥር' : 'Numbers', icon: Hash },
    { n: 3 as Step, label: am ? 'ብር' : 'Birr', icon: Trophy },
  ];

  return (
    <div className="space-y-4 pb-24">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="keno-title text-xl sm:text-2xl">
            {am ? 'ጨዋታ ጀምር' : t.rooms?.title || 'Play'}
          </h1>
          <p className="mt-1 text-xs text-white/45">
            {am
              ? 'ደረጃ በደረጃ ይምረጡ — ቀላል ነው'
              : 'Follow the steps — simple and clear'}
          </p>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/30 p-2">
        {steps.map((s, i) => {
          const done =
            (s.n === 1 && groupSize != null) ||
            (s.n === 2 && picks.length > 0) ||
            (s.n === 3 && prize != null);
          const active = step === s.n;
          const Icon = s.icon;
          return (
            <button
              key={s.n}
              type="button"
              onClick={() => {
                if (s.n === 1) goStep1();
                else if (s.n === 2 && groupSize) goStep2();
                else if (s.n === 3 && picks.length > 0) goStep3();
              }}
              className={clsx(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition',
                active && 'bg-equb-500 text-white shadow-md shadow-equb-500/30',
                !active && done && 'bg-equb-500/15 text-equb-200',
                !active && !done && 'text-white/35',
              )}
            >
              {done && !active ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.n}</span>
            </button>
          );
        })}
      </div>

      {/* Live rooms shortcut */}
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

      {/* STEP 1 — Players */}
      {step === 1 && (
        <section className="animate-fade-up glass space-y-4 rounded-2xl p-5">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-equb-500/20 text-equb-300">
              <Users className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-black text-white">
              {am ? 'ስንት ተጫዋቾች?' : 'How many players?'}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {am
                ? 'የቡድን መጠን ይምረጡ · ቢያንስ 5 ሰዎች ያስፈልጋሉ'
                : 'Choose group size · at least 5 players needed'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {GROUP_SIZES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => selectPlayers(g)}
                className={clsx(
                  'rounded-2xl border-2 py-4 text-lg font-black transition active:scale-95',
                  groupSize === g
                    ? 'border-equb-400 bg-equb-500 text-white shadow-lg shadow-equb-500/30'
                    : 'border-white/10 bg-black/30 text-white/80 hover:border-equb-500/40',
                )}
              >
                {g}
              </button>
            ))}
          </div>

          <p className="text-center text-[11px] text-white/35">
            {am
              ? 'ከመረጡ በኋላ ቁጥር መምረጥ ይቀጥላል'
              : 'Next: pick your bingo numbers'}
          </p>
        </section>
      )}

      {/* STEP 2 — Numbers */}
      {step === 2 && groupSize != null && (
        <section className="animate-fade-up glass space-y-4 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={goStep1}
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
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-300">
              <Hash className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-black text-white">
              {am ? 'ቁጥርዎን ይምረጡ' : 'Pick your numbers'}
            </h2>
            <p className="mt-1 text-sm text-white/50">
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

          <button
            type="button"
            disabled={picks.length === 0}
            onClick={goStep3}
            className="btn-gold flex w-full items-center justify-center gap-2 py-3.5 text-base disabled:opacity-40"
          >
            {am ? 'ቀጥል · ብር ይምረጡ' : 'Next · choose Birr'}
            <ChevronRight className="h-5 w-5" />
          </button>
        </section>
      )}

      {/* STEP 3 — Birr / Prize */}
      {step === 3 && groupSize != null && picks.length > 0 && (
        <section className="animate-fade-up glass space-y-4 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={goStep2}
              className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/60"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {am ? 'ተመለስ' : 'Back'}
            </button>
            <div className="text-right text-xs text-white/50">
              <p>
                {groupSize} {am ? 'ተጫዋቾች' : 'players'} · #{' '}
                {picks.map((n) => String(n).padStart(2, '0')).join(',')}
              </p>
            </div>
          </div>

          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500/15 text-gold-300">
              <Trophy className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-black text-white">
              {am ? 'በስንት ብር ይጫወታሉ?' : 'How much Birr?'}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {am ? 'የሽልማት / ጨዋታ መጠን ይምረጡ' : 'Choose the prize amount'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRIZES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrize(p)}
                className={clsx(
                  'rounded-2xl border-2 py-4 text-base font-black transition active:scale-95',
                  prize === p
                    ? 'border-gold-400 bg-gold-400 text-black shadow-lg shadow-gold-500/30'
                    : 'border-white/10 bg-black/30 text-white/85 hover:border-gold-400/40',
                )}
              >
                {formatBirrCompact(p, locale)}
              </button>
            ))}
          </div>

          {prize != null && (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-black/40 p-4">
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
                    ({picks.length} × {formatBirrCompact(contribution, locale)})
                  </span>
                </span>
                <span className="font-mono text-lg font-black text-gold-300">
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
            className="btn-gold relative flex w-full items-center justify-center gap-2 overflow-hidden py-3.5 text-base disabled:opacity-40"
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

      {err && (
        <p className="animate-fade-up rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-200">
          {err}
        </p>
      )}
    </div>
  );
}
