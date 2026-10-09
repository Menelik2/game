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
import { ChevronRight, Radio } from 'lucide-react';

const PRIZES = [500, 1000, 2000, 5000, 9000];

export default function RoomsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const rooms = useEqubStore((s) => s.rooms);
  const ensureRooms = useEqubStore((s) => s.ensureRooms);
  const user = useEqubStore((s) => s.user);
  const joinLocal = useEqubStore((s) => s.joinRoom);

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
      const open = (roomsList || [])
        .filter((r) => r.status === 'open' && (r.members?.length || 0) > 0)
        .sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));
      setLiveOpen(open);
    } catch {
      setLiveOk(false);
    }
  }, [multiplayer]);

  useEffect(() => {
    ensureRooms();
  }, [ensureRooms]);

  useEffect(() => {
    void refreshLive();
    const iv = setInterval(() => void refreshLive(), 3000);
    return () => clearInterval(iv);
  }, [refreshLive]);

  useEffect(() => {
    setPicks([]);
  }, [groupSize]);

  function togglePick(n: number) {
    setPicks((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= maxPicks) {
        setErr(
          locale === 'am'
            ? `ከፍተኛ ${maxPicks} ቁጥር`
            : `Max ${maxPicks} number(s) for this room`,
        );
        return prev;
      }
      setErr('');
      return [...prev, n].sort((a, b) => a - b);
    });
  }

  function openLocalRoom(chosen: number[]): boolean {
    const u = useEqubStore.getState().user;
    if (!u) {
      setErr(locale === 'am' ? 'መጀመሪያ ይግቡ' : 'Sign in first');
      return false;
    }
    ensureRooms();
    const list = useEqubStore.getState().rooms;
    if (!list.some((r) => r.id === templateId)) {
      useEqubStore.setState({
        rooms: [
          ...list,
          {
            id: templateId,
            groupSize,
            prizePool: prize,
            contribution: contributionPerMember(prize, groupSize),
            tier: prize <= 500 ? 'entry' : prize < 10000 ? 'low' : 'mid',
            status: 'open',
            members: [],
            winningNumber: null,
            winnerId: null,
            winnerName: null,
          },
        ],
      });
    }
    const res = joinLocal(templateId, chosen);
    if (!res.ok) {
      setErr(res.message);
      return false;
    }
    return true;
  }

  async function handleOpenRoom() {
    if (picks.length === 0) {
      setErr(
        locale === 'am'
          ? `ቢያንስ 1 ቁጥር ይምረጡ (ከፍተኛ ${maxPicks})`
          : `Select at least 1 number (max ${maxPicks})`,
      );
      return;
    }
    if (picks.length > maxPicks) {
      setErr(`Max ${maxPicks} for group ${groupSize}`);
      return;
    }
    if (!user) {
      setErr(locale === 'am' ? 'መጀመሪያ ይግቡ' : 'Sign in first');
      router.push('/profile');
      return;
    }

    setBusy(true);
    setErr('');
    const safety = setTimeout(() => setBusy(false), 8000);

    try {
      if (multiplayer) {
        setPlayerName(user.name || 'Player');
        try {
          await openRoom(templateId);
          await mpJoin(templateId, picks);
          router.push(
            `/rooms/${encodeURIComponent(templateId)}?picks=${picks.join(',')}`,
          );
          return;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Join failed';
          if (!openLocalRoom(picks)) {
            setErr(msg);
            return;
          }
        }
      } else if (!openLocalRoom(picks)) {
        return;
      }
      router.push(`/rooms/${encodeURIComponent(templateId)}`);
    } finally {
      clearTimeout(safety);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 pb-24">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="keno-title text-xl sm:text-2xl">{t.rooms.title}</h1>
          <p className="mt-1 text-xs text-white/45">{t.rooms.subtitle}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {multiplayer && liveOk && liveOpen.length > 0 && (
        <section className="animate-fade-up glass relative overflow-hidden rounded-2xl p-4">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-equb-500/20 blur-2xl" />
          <p className="relative mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-equb-300">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {locale === 'am' ? 'ክፍት ክፍሎች' : 'Open rooms'}
            <span className="ml-auto rounded-full bg-equb-500/25 px-2 py-0.5 text-[10px] text-equb-200">
              LIVE
            </span>
          </p>
          <div className="relative space-y-2">
            {liveOpen.slice(0, 8).map((r, i) => (
              <Link
                key={r.id}
                href={`/rooms/${encodeURIComponent(r.templateId || r.id)}`}
                style={{ animationDelay: `${i * 60}ms` }}
                className="animate-fade-up flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 transition duration-200 hover:scale-[1.02] hover:border-equb-500/50 hover:bg-equb-500/10 active:scale-[0.98]"
              >
                <div>
                  <p className="text-sm font-bold">
                    {r.groupSize} {t.rooms.players} ·{' '}
                    {formatBirrCompact(r.prizePool, locale)}
                  </p>
                  <p className="text-[10px] text-white/40">
                    {(r.members?.length || 0)}/{r.groupSize}{' '}
                    {locale === 'am' ? 'ተጫዋቾች' : 'players'}
                  </p>
                </div>
                <SeatRing total={r.groupSize} filledCount={r.members?.length || 0} size="sm" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-4">
        <div className="animate-fade-up" style={{ animationDelay: '40ms' }}>
          <PickRuleCard groupSize={groupSize} locale={locale} />
        </div>

        <section
          className="animate-fade-up glass relative overflow-hidden rounded-2xl p-4 sm:p-5"
          style={{ animationDelay: '80ms' }}
        >
          <div className="pointer-events-none absolute -left-8 top-0 h-20 w-20 rounded-full bg-equb-500/10 blur-2xl" />
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
            1 · {locale === 'am' ? 'የቡድን መጠን' : 'Group size'}
          </p>
          <p className="mb-3 text-[11px] text-white/40">
            {locale === 'am'
              ? 'ክፍል የሚቀላቀሉ ተጫዋቾች ብዛት'
              : 'How many players can join this room'}
          </p>
          <div className="flex flex-wrap gap-2">
            {GROUP_SIZES.map((g, i) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupSize(g)}
                style={{ animationDelay: `${i * 25}ms` }}
                className={clsx(
                  'flex min-h-[2.75rem] min-w-[2.75rem] items-center justify-center rounded-xl px-3 py-2.5 text-sm font-bold transition duration-200 active:scale-95',
                  groupSize === g
                    ? 'chip-active scale-105 shadow-lg shadow-equb-500/25 ring-1 ring-equb-400/50'
                    : 'chip hover:scale-105 hover:border-white/20',
                )}
              >
                {g}
              </button>
            ))}
          </div>
          <PickRuleHint groupSize={groupSize} locale={locale} />
        </section>

        <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <NumberPickBoard
            groupSize={groupSize}
            picks={picks}
            maxPicks={maxPicks}
            locale={locale}
            onToggle={togglePick}
            onClear={() => {
              setPicks([]);
              setErr('');
            }}
          />
        </div>

        <section
          className="animate-fade-up relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-black/40 p-4 shadow-xl shadow-black/30 sm:p-5"
          style={{ animationDelay: '160ms' }}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-equb-500/10 blur-2xl" />

          <div className="relative mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gold-400/90">
                3 · {locale === 'am' ? 'ሽልማት' : 'Prize pool'}
              </p>
              <p className="mt-0.5 text-[11px] text-white/40">
                {locale === 'am'
                  ? 'አሸናፊው ይህን ሙሉ ሽልማት ይወስዳል'
                  : 'Winner takes this full prize'}
              </p>
            </div>
            <div className="rounded-xl border border-gold-500/30 bg-gold-500/15 px-3 py-1.5 text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-gold-400/80">
                {locale === 'am' ? 'ተመርጧል' : 'Selected'}
              </p>
              <p className="font-mono text-base font-black tabular-nums text-gold-300">
                {formatBirrCompact(prize, locale)}
              </p>
            </div>
          </div>

          <div className="relative grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRIZES.map((p) => {
              const active = prize === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrize(p)}
                  className={clsx(
                    'group relative flex flex-col items-center justify-center rounded-2xl border px-3 py-3.5 transition duration-200 active:scale-[0.97]',
                    active
                      ? 'border-gold-400/60 bg-gradient-to-b from-gold-500/25 to-gold-600/10 shadow-lg shadow-gold-500/20 ring-1 ring-gold-400/40'
                      : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]',
                  )}
                >
                  {active && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gold-400 shadow shadow-gold-400/50" />
                  )}
                  <span
                    className={clsx(
                      'font-mono text-lg font-black tabular-nums tracking-tight sm:text-xl',
                      active ? 'text-gold-200' : 'text-white/90',
                    )}
                  >
                    {p.toLocaleString()}
                  </span>
                  <span
                    className={clsx(
                      'mt-0.5 text-[10px] font-semibold uppercase tracking-wider',
                      active ? 'text-gold-400/90' : 'text-white/35',
                    )}
                  >
                    {locale === 'am' ? 'ብር' : 'Birr'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/50">
            <div className="grid grid-cols-3 divide-x divide-white/10">
              <div className="px-2 py-3 text-center sm:px-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  {locale === 'am' ? 'ቡድን' : 'Group'}
                </p>
                <p className="mt-1 font-mono text-base font-black tabular-nums text-white">
                  {groupSize}
                </p>
                <p className="text-[10px] text-white/30">
                  {locale === 'am' ? 'ተጫዋቾች' : 'players'}
                </p>
              </div>
              <div className="px-2 py-3 text-center sm:px-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  {locale === 'am' ? 'በቁጥር' : 'Per number'}
                </p>
                <p className="mt-1 font-mono text-base font-black tabular-nums text-white">
                  {formatBirrCompact(contribution, locale)}
                </p>
                <p className="text-[10px] text-white/30">
                  {locale === 'am' ? 'አስተዋጽዖ' : 'entry fee'}
                </p>
              </div>
              <div className="bg-gold-500/10 px-2 py-3 text-center sm:px-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-gold-400/80">
                  {locale === 'am' ? 'የእርስዎ' : 'You pay'}
                </p>
                <p className="mt-1 font-mono text-base font-black tabular-nums text-gold-300">
                  {formatBirrCompact(totalFee > 0 ? totalFee : contribution, locale)}
                </p>
                <p className="text-[10px] text-gold-400/50">
                  {picks.length > 0
                    ? locale === 'am'
                      ? `${picks.length} ቁጥር`
                      : `${picks.length} pick${picks.length > 1 ? 's' : ''}`
                    : locale === 'am'
                      ? '1 ቁጥር'
                      : '1 pick'}
                </p>
              </div>
            </div>
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
              ? 'ክፍል ክፈት / ተቀላቀል'
              : 'Open / Join room'}
          <ChevronRight className="h-5 w-5" />
        </button>

        {rooms.filter((r) => r.members.length > 0).length > 0 && (
          <section className="animate-fade-up space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">
              {locale === 'am' ? 'የአካባቢ ክፍሎች' : 'Local rooms'}
            </p>
            {rooms
              .filter((r) => r.members.length > 0)
              .map((r) => (
                <Link
                  key={r.id}
                  href={`/rooms/${encodeURIComponent(r.id)}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 transition hover:border-equb-500/40 hover:bg-equb-500/10 active:scale-[0.98]"
                >
                  <span className="text-sm font-semibold">
                    {r.groupSize} · {formatBirrCompact(r.prizePool, locale)}
                  </span>
                  <SeatRing total={r.groupSize} filledCount={r.members.length} size="sm" />
                </Link>
              ))}
          </section>
        )}
      </div>
    </div>
  );
}
