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
import { ChevronRight, Radio, Trophy, Users, Hash } from 'lucide-react';

const PRIZES = [500, 1000, 2000, 5000, 9000];

export default function RoomsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const am = locale === 'am';
  const user = useEqubStore((s) => s.user);

  const [groupSize, setGroupSize] = useState(5);
  const [picks, setPicks] = useState<number[]>([]);
  const [prize, setPrize] = useState(500);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [liveOpen, setLiveOpen] = useState<ServerRoom[]>([]);
  const [liveOk, setLiveOk] = useState(false);
  const multiplayer = isMultiplayerEnabled();

  const maxPicks = maxPicksForGroup(groupSize);
  const contribution = useMemo(
    () => contributionPerMember(prize, groupSize),
    [prize, groupSize],
  );
  const templateId = roomId(groupSize, prize);

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

  async function handleJoin() {
    if (!user) {
      setErr(am ? 'መጀመሪያ ይግቡ' : 'Sign in first');
      router.push('/profile');
      return;
    }
    if (picks.length === 0) {
      setErr(am ? 'ቁጥር ይምረጡ' : 'Pick at least one number');
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

  const liveDisplay = useMemo(() => {
    const withP = liveOpen.filter((r) => (r.members?.length || 0) > 0);
    const empty = liveOpen.filter((r) => (r.members?.length || 0) === 0);
    return [...withP, ...empty].slice(0, 4);
  }, [liveOpen]);

  return (
    <div className="space-y-3 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="keno-title text-xl sm:text-2xl">
            {am ? 'ጨዋታ ጀምር' : t.rooms?.title || 'Play'}
          </h1>
          <p className="mt-0.5 text-xs text-white/45">
            {am ? 'ተጫዋቾች · ቁጥር · ብር — በአንድ ገጽ' : 'Players · numbers · birr — one page'}
          </p>
        </div>
        <LanguageSwitcher />
      </div>

      {multiplayer && liveOk && liveDisplay.length > 0 && (
        <section className="glass content-auto rounded-2xl p-3" aria-label={am ? 'ቀጥታ ክፍሎች' : 'Live rooms'}>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-equb-300">
            <Radio className="h-3 w-3 animate-pulse" aria-hidden />
            {am ? 'ቀጥታ ክፍሎች' : 'Live rooms'}
          </p>
          <div className="space-y-1.5">
            {liveDisplay.map((r) => {
              const filled = r.members?.length || r.playerCount || 0;
              const max = r.groupSize || r.maxPlayers || 5;
              return (
                <Link
                  key={r.id || r.templateId}
                  href={`/rooms/${encodeURIComponent(r.templateId || r.id)}`}
                  className="flex items-center justify-between rounded-xl border border-equb-500/25 bg-black/25 px-3 py-2 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-equb-400"
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

      <section className="glass space-y-2 rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-equb-300" aria-hidden />
          <h2 className="text-sm font-bold text-white">
            {am ? '1. ስንት ተጫዋቾች?' : '1. How many players?'}
          </h2>
        </div>
        <div
          className="grid grid-cols-5 gap-1.5"
          role="radiogroup"
          aria-label={am ? 'የቡድን መጠን' : 'Group size'}
        >
          {GROUP_SIZES.map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={groupSize === g}
              onClick={() => {
                setGroupSize(g);
                setPicks([]);
                setErr('');
              }}
              className={clsx(
                'rounded-xl border py-2 text-sm font-bold transition active:scale-95 focus-visible:ring-2 focus-visible:ring-equb-400',
                groupSize === g
                  ? 'border-equb-400 bg-equb-500 text-white shadow-md shadow-equb-500/25'
                  : 'border-white/10 bg-black/30 text-white/80',
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </section>

      <section className="glass space-y-2 rounded-2xl p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 text-amber-300" aria-hidden />
            <h2 className="text-sm font-bold text-white">
              {am ? '2. ቁጥርዎን ይምረጡ' : '2. Pick numbers'}
            </h2>
          </div>
          <span className="text-[10px] text-white/40">
            {am ? `ከፍ. ${maxPicks}` : `max ${maxPicks}`}
          </span>
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
            setErr('');
          }}
          onClear={() => setPicks([])}
        />
        {picks.length > 0 && (
          <p className="text-center text-xs text-equb-200" aria-live="polite">
            {am ? 'የመረጡት' : 'Selected'}:{' '}
            <span className="font-mono font-bold">
              {picks.map((n) => String(n).padStart(2, '0')).join(' · ')}
            </span>
          </p>
        )}
      </section>

      <section className="glass space-y-2 rounded-2xl p-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-gold-300" aria-hidden />
          <h2 className="text-sm font-bold text-white">
            {am ? '3. በስንት ብር?' : '3. How much Birr?'}
          </h2>
        </div>
        <div
          className="grid grid-cols-5 gap-1.5"
          role="radiogroup"
          aria-label={am ? 'የብር መጠን' : 'Prize amount'}
        >
          {PRIZES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={prize === p}
              onClick={() => {
                setPrize(p);
                setErr('');
              }}
              className={clsx(
                'rounded-xl border py-2 text-xs font-bold transition active:scale-95 focus-visible:ring-2 focus-visible:ring-gold-400 sm:text-sm',
                prize === p
                  ? 'border-gold-400 bg-gold-400 text-black shadow-md shadow-gold-500/25'
                  : 'border-white/10 bg-black/30 text-white/85',
              )}
            >
              {formatBirrCompact(p, locale)}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between rounded-xl bg-black/40 px-3 py-2 text-xs">
          <span className="text-white/50">{am ? 'እርስዎ የሚከፍሉት' : 'You pay'}</span>
          <span className="font-mono font-black text-gold-300">
            {picks.length > 0
              ? formatBirrCompact(
                  Math.round(contribution * picks.length * 100) / 100,
                  locale,
                )
              : formatBirrCompact(contribution, locale)}
          </span>
        </div>
      </section>

      {err && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200"
        >
          {err}
        </p>
      )}

      <button
        type="button"
        disabled={busy || picks.length === 0}
        aria-busy={busy}
        aria-disabled={busy || picks.length === 0}
        onClick={() => void handleJoin()}
        className="btn-gold flex w-full items-center justify-center gap-2 py-3.5 text-base disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-gold-400"
      >
        {busy ? '...' : am ? 'ጨዋታ ጀምር' : 'Join & play'}
        <ChevronRight className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}
