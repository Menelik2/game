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
import { PickRuleCard, PickRuleHint } from '@/components/PickRule';
import { NumberPickBoard } from '@/components/NumberPickBoard';
import clsx from 'clsx';
import { ChevronRight, Radio, Trophy, Users, Wallet, Check } from 'lucide-react';

const PRIZES = [500, 1000, 2000, 5000, 9000];

export default function RoomsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
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
  const totalFee = Math.round(contribution * picks.length * 100) / 100;
  const templateId = roomId(groupSize, prize);
  const canOpen = picks.length > 0 && !busy;

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
      // Show all open live rooms (with or without members)
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

  async function handleOpenRoom() {
    if (!user) {
      setErr(locale === 'am' ? 'መጀመሪያ ይግቡ' : 'Sign in first');
      router.push('/profile');
      return;
    }
    if (picks.length === 0) {
      setErr(
        locale === 'am' ? 'ቢያንስ አንድ ቁጥር ይምረጡ' : 'Pick at least one number',
      );
      return;
    }
    if (picks.length > maxPicks) {
      setErr(
        locale === 'am'
          ? `ከፍተኛ ${maxPicks} ቁጥር ብቻ`
          : `Max ${maxPicks} number(s)`,
      );
      return;
    }

    const feeNeed = totalFee;
    if (feeNeed > 0 && Number(user.balance || 0) < feeNeed) {
      setErr(
        locale === 'am'
          ? `በቂ ብር የለም (ያስፈልጋል ${feeNeed}) — ወደ ኪስ ይሂዱ`
          : `Need ${feeNeed} Birr — deposit in Wallet first`,
      );
      return;
    }

    setBusy(true);
    setErr('');
    const safety = setTimeout(() => setBusy(false), 12_000);

    try {
      setPlayerName(user.name || 'Player');
      // Always use LIVE shared rooms — no local-only fallback
      await openRoom(templateId);
      await mpJoin(templateId, picks);
      router.push(
        `/rooms/${encodeURIComponent(templateId)}?picks=${picks.join(',')}`,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Join failed';
      setErr(msg);
    } finally {
      clearTimeout(safety);
      setBusy(false);
    }
  }

  // Prefer rooms with players, then warm empties (max 8)
  const liveWithPlayers = liveOpen.filter((r) => (r.members?.length || 0) > 0);
  const liveEmpty = liveOpen.filter((r) => (r.members?.length || 0) === 0);
  const liveDisplay = [...liveWithPlayers, ...liveEmpty].slice(0, 8);

  return (
    <div className="space-y-4 pb-24">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="keno-title text-xl sm:text-2xl">{t.rooms.title}</h1>
          <p className="mt-1 text-xs text-white/45">{t.rooms.subtitle}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {/* LIVE rooms — shared multiplayer */}
      {multiplayer && liveOk && (
        <section className="animate-fade-up glass relative overflow-hidden rounded-2xl p-4">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-equb-500/20 blur-2xl" />
          <p className="relative mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-equb-300">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {locale === 'am' ? 'ቀጥታ ክፍሎች' : 'Live rooms'}
            <span className="ml-auto rounded-full bg-equb-500/25 px-2 py-0.5 text-[10px] text-equb-200">
              LIVE
            </span>
          </p>
          {liveDisplay.length === 0 ? (
            <p className="relative text-center text-xs text-white/40">
              {locale === 'am'
                ? 'ገና ክፍት ክፍል የለም — ከታች ይምረጡና ይቀላቀሉ'
                : 'No open rooms yet — pick below and join'}
            </p>
          ) : (
            <div className="relative space-y-2">
              {liveDisplay.map((r, i) => {
                const filled = r.members?.length || r.playerCount || 0;
                const max = r.groupSize || r.maxPlayers || 5;
                const label = `${max} · ${formatBirrCompact(r.prizePool, locale)}`;
                return (
                  <Link
                    key={r.id || r.templateId}
                    href={`/rooms/${encodeURIComponent(r.templateId || r.id)}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                    className="animate-fade-up flex items-center justify-between rounded-xl border border-equb-500/30 bg-black/30 px-3 py-2.5 transition duration-200 hover:scale-[1.02] hover:border-equb-500/50 hover:bg-equb-500/10 active:scale-[0.98]"
                  >
                    <div>
                      <span className="text-sm font-semibold text-white">
                        {label}
                      </span>
                      <p className="text-[10px] text-equb-300/80">
                        {locale === 'am' ? 'ቀጥታ' : 'Live'} ·{' '}
                        {filled}/{max}{' '}
                        {locale === 'am' ? 'ተጫዋቾች' : 'players'}
                      </p>
                    </div>
                    <SeatRing total={max} filledCount={filled} size="sm" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {multiplayer && !liveOk && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-100">
          {locale === 'am'
            ? 'ቀጥታ አገልግሎት በመገናኘት ላይ…'
            : 'Connecting to live servers…'}
        </p>
      )}

      <div className="space-y-4">
        <PickRuleCard groupSize={groupSize} locale={locale} />

        <section className="glass space-y-3 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-white/50">
            1 · {locale === 'am' ? 'የቡድን መጠን' : 'Group size'}
          </p>
          <p className="text-[11px] text-white/40">
            {locale === 'am'
              ? 'ቢያንስ 5 ተጫዋቾች ለመጀመር ያስፈልጋሉ'
              : 'At least 5 players required to start'}
          </p>
          <div className="flex flex-wrap gap-2">
            {GROUP_SIZES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => {
                  setGroupSize(g);
                  setPicks([]);
                }}
                className={clsx(
                  'rounded-full px-3 py-1.5 text-sm font-bold transition',
                  groupSize === g
                    ? 'bg-equb-500 text-white shadow-lg shadow-equb-500/30'
                    : 'border border-white/10 text-white/60 hover:border-white/25',
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <PickRuleHint groupSize={groupSize} locale={locale} />
        </section>

        <section className="glass space-y-3 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-white/50">
            2 · {locale === 'am' ? 'ቁጥር ይምረጡ' : 'Pick numbers'}
          </p>
          <NumberPickBoard
            groupSize={groupSize}
            selected={picks}
            maxPicks={maxPicks}
            locale={locale}
            onChange={setPicks}
          />
        </section>

        <section className="glass space-y-3 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-gold-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">
              3 · {locale === 'am' ? 'ሽልማት' : 'Prize'}
            </p>
          </div>
          <p className="text-[11px] text-white/40">
            {locale === 'am' ? 'የሽልማት መጠን ይምረጡ' : 'Choose your prize amount'}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PRIZES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrize(p)}
                className={clsx(
                  'rounded-xl py-2.5 text-sm font-bold transition',
                  prize === p
                    ? 'bg-gold-400 text-black shadow-md shadow-gold-500/30'
                    : 'border border-white/10 text-white/70 hover:border-gold-400/40',
                )}
              >
                {formatBirrCompact(p, locale)}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-center">
              <p className="text-white/40">{locale === 'am' ? 'ተጫዋቾች' : 'Players'}</p>
              <p className="font-mono text-sm font-bold text-white">
                {groupSize}
              </p>
            </div>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-2 py-2 text-center">
              <p className="text-cyan-300/80">{locale === 'am' ? 'መግቢያ' : 'Entry'}</p>
              <p className="font-mono text-sm font-bold text-cyan-200">
                {formatBirrCompact(contribution, locale)}
              </p>
              <p className="text-[9px] text-white/35">
                {locale === 'am' ? 'በ1 ቁጥር' : 'per number'}
              </p>
            </div>
            <div className="rounded-xl border border-gold-500/20 bg-gold-500/5 px-2 py-2 text-center">
              <p className="text-gold-400/70">{locale === 'am' ? 'ሽልማት' : 'Prize'}</p>
              <p className="font-mono text-sm font-bold text-gold-300">
                {formatBirrCompact(prize, locale)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-3 py-2">
            <span className="text-xs text-white/50">
              {locale === 'am' ? 'እርስዎ የሚከፍሉት' : 'You pay'}
              {picks.length > 1 && (
                <span className="ml-1 text-white/30">
                  ({picks.length} × {formatBirrCompact(contribution, locale)})
                </span>
              )}
            </span>
            <span className="font-mono text-sm font-black tabular-nums text-gold-300">
              {formatBirrCompact(
                picks.length > 0 ? totalFee : contribution,
                locale,
              )}
            </span>
          </div>
        </section>

        {err && (
          <p className="animate-fade-up rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
            {err}
          </p>
        )}

        <button
          type="button"
          disabled={!canOpen}
          onClick={() => void handleOpenRoom()}
          className="btn-gold relative flex w-full items-center justify-center gap-2 overflow-hidden py-3.5 text-base disabled:opacity-40"
        >
          {canOpen && (
            <span className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/25 to-transparent" />
          )}
          {busy
            ? '...'
            : locale === 'am'
              ? 'ቀጥታ ክፍል ተቀላቀል'
              : 'Join live room'}
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
