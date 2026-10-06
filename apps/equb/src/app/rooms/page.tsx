'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import {
  GROUP_SIZES,
  contributionPerMember,
  roomId,
  seatsLeft,
  takenPicks,
  maxPicksForGroup,
  type LiveRoom,
} from '@/lib/equb-math';
import {
  isMultiplayerEnabled,
  openRoom,
  joinRoom as mpJoin,
  setPlayerName,
  listLiveRooms,
  listTemplates,
  probeApi,
  type ServerRoom,
  type LiveTemplate,
} from '@/lib/multiplayer';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { formatBirrCompact } from '@/lib/money';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SeatNodes, SeatRing } from '@/components/SeatNodes';
import { PickRuleCard, PickRuleHint } from '@/components/PickRule';
import clsx from 'clsx';
import { ChevronRight, Users, Radio } from 'lucide-react';

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
  const [templates, setTemplates] = useState<LiveTemplate[]>([]);
  const [liveOk, setLiveOk] = useState(false);
  const multiplayer = isMultiplayerEnabled();

  const maxPicks = maxPicksForGroup(groupSize);
  const contribution = useMemo(
    () => contributionPerMember(prize, groupSize),
    [prize, groupSize],
  );
  const totalFee = Math.round(contribution * picks.length * 100) / 100;
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
      const [roomsList, tpl] = await Promise.all([
        listLiveRooms().catch(() => [] as ServerRoom[]),
        listTemplates().catch(() => [] as LiveTemplate[]),
      ]);
      const open = (roomsList || [])
        .filter((r) => r.status === 'open' && (r.members?.length || 0) > 0)
        .sort((a, b) => (b.members?.length || 0) - (a.members?.length || 0));
      setLiveOpen(open);
      setTemplates(tpl || []);
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
          clearTimeout(safety);
          setBusy(false);
          router.push(`/rooms/${templateId}?picks=${picks.join(',')}`);
          return;
        } catch (apiErr: unknown) {
          console.warn('API open/join failed — local room', apiErr);
        }
      }

      const ok = openLocalRoom(picks);
      clearTimeout(safety);
      setBusy(false);
      if (ok) router.push(`/rooms/${templateId}`);
    } catch (e: unknown) {
      clearTimeout(safety);
      setBusy(false);
      if (openLocalRoom(picks)) {
        router.push(`/rooms/${templateId}`);
      } else {
        setErr(e instanceof Error ? e.message : t.common.error);
      }
    }
  }

  const localOpen = rooms
    .filter((r) => r.status === 'open' && r.members.length > 0)
    .slice(0, 12);
  const previewTaken = new Set(picks);
  const activeTemplates = templates.filter(
    (x) => x.status === 'open' && x.seatsTaken > 0,
  );

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl lg:text-3xl">
            {t.rooms.title}
          </h1>
          <p className="mt-1 text-xs text-white/45 sm:text-sm">{t.rooms.subtitle}</p>
          {liveOk && (
            <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-equb-400">
              <Radio className="h-3 w-3 animate-pulse" />
              {locale === 'am' ? 'ቀጥታ ክፍሎች' : 'Live rooms'}
            </p>
          )}
        </div>
        <LanguageSwitcher />
      </div>

      {!user && (
        <Link
          href="/profile"
          className="block rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm font-semibold text-amber-100"
        >
          {locale === 'am' ? 'ለመጫወት መጀመሪያ ይግቡ' : 'Sign in to play'}
        </Link>
      )}

      {(liveOpen.length > 0 || activeTemplates.length > 0) && (
        <section className="rounded-2xl border border-equb-500/30 bg-equb-500/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-equb-300" />
            <h2 className="text-sm font-bold text-equb-100">
              {locale === 'am' ? 'ክፍት ክፍሎች · ይቀላቀሉ' : 'Open rooms · join'}
            </h2>
          </div>
          <div className="space-y-2">
            {liveOpen.map((r) => {
              const taken = new Set(
                r.members.flatMap((m) => m.picks || [m.pick]),
              );
              const href = r.templateId
                ? `/rooms/${r.templateId}`
                : `/rooms/${r.id}`;
              return (
                <Link
                  key={r.id}
                  href={href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3 transition hover:border-equb-500/40"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {r.groupSize} {t.rooms.players} ·{' '}
                      <span className="text-gold-400">
                        {formatBirrCompact(r.prizePool, locale)}
                      </span>
                    </p>
                    <p className="text-[11px] text-white/45">
                      {locale === 'am'
                        ? `ከፍተኛ ${maxPicksForGroup(r.groupSize)} ቁጥር / ተጫዋች`
                        : `max ${maxPicksForGroup(r.groupSize)} picks / player`}
                    </p>
                    <SeatNodes
                      total={r.groupSize}
                      taken={taken}
                      yourPick={null}
                      size="sm"
                      maxVisible={Math.min(r.groupSize, 20)}
                      className="mt-2"
                    />
                  </div>
                  <span className="rounded-full bg-equb-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-md shadow-equb-500/30">
                    {locale === 'am' ? 'ቀላቀል' : 'Join'}
                  </span>
                </Link>
              );
            })}
            {liveOpen.length === 0 &&
              activeTemplates.map((tpl) => (
                <Link
                  key={tpl.id}
                  href={`/rooms/${tpl.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-3"
                >
                  <p className="text-sm font-semibold">
                    {tpl.groupSize} · {formatBirrCompact(tpl.prizePool, locale)}
                  </p>
                  <ChevronRight className="h-4 w-4 text-white/30" />
                </Link>
              ))}
          </div>
        </section>
      )}

      <div className="space-y-4">
        <PickRuleCard groupSize={groupSize} locale={locale} />

        <section className="glass rounded-2xl p-4 sm:p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
            1 · {locale === 'am' ? 'የቡድን መጠን' : 'Group size'}
          </p>
          <div className="flex flex-wrap gap-2">
            {GROUP_SIZES.filter((g) => g <= 50).map((g) => {
              const gMax = maxPicksForGroup(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupSize(g)}
                  className={clsx(
                    'flex min-w-[2.75rem] flex-col items-center rounded-xl px-3 py-2 transition active:scale-95',
                    groupSize === g ? 'chip-active ring-1 ring-equb-500/40' : 'chip',
                  )}
                >
                  <span className="text-sm font-bold">{g}</span>
                  <span className="text-[9px] font-semibold opacity-70">
                    {locale === 'am' ? `ከፍ. ${gMax}` : `max ${gMax}`}
                  </span>
                </button>
              );
            })}
          </div>
          <PickRuleHint groupSize={groupSize} locale={locale} />
        </section>

        <section className="glass rounded-2xl p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-white/50">
              2 · {locale === 'am' ? 'ቁጥሮችዎ' : 'Your numbers'}
            </p>
            <span className="rounded-full bg-equb-500/20 px-2.5 py-1 text-[11px] font-bold text-equb-300">
              {picks.length}/{maxPicks}{' '}
              {locale === 'am' ? 'ቁጥር' : 'picks'}
            </span>
          </div>

          <div className="mb-4 flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-b from-black/40 to-black/20 p-4">
            <SeatRing
              total={groupSize}
              filledCount={picks.length}
              yourPicks={picks}
              taken={previewTaken}
            />
            <SeatNodes
              total={groupSize}
              taken={previewTaken}
              yourPicks={picks}
              size="md"
              maxVisible={Math.min(groupSize, 20)}
              className="justify-center"
            />
            {picks.length > 0 && (
              <p className="font-mono text-xs font-bold text-equb-300 animate-[fadeIn_0.3s_ease-out]">
                #{picks.map((p) => String(p).padStart(2, '0')).join(' · #')}
              </p>
            )}
          </div>

          <div
            className="grid gap-1.5 sm:gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.min(groupSize <= 20 ? 5 : 10, groupSize)}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: groupSize }, (_, i) => i + 1).map((n) => {
              const on = picks.includes(n);
              const locked = !on && picks.length >= maxPicks;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={locked}
                  onClick={() => togglePick(n)}
                  className={clsx(
                    'relative flex aspect-square items-center justify-center rounded-xl text-[11px] font-black transition-all duration-200 active:scale-90 sm:text-sm',
                    on &&
                      'scale-105 bg-equb-500 text-white ring-2 ring-equb-200 shadow-lg shadow-equb-500/40',
                    locked && 'cursor-not-allowed bg-[#151c1a] text-white/25',
                    !on &&
                      !locked &&
                      'bg-[#151c1a] text-white/80 shadow-sm hover:scale-105 hover:bg-white/12 hover:shadow-md',
                  )}
                >
                  <span className="relative z-10">{String(n).padStart(2, '0')}</span>
                  {on && (
                    <span className="pointer-events-none absolute inset-0 animate-pulse rounded-xl bg-equb-400/25" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass rounded-2xl p-4 sm:p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
            3 · {locale === 'am' ? 'ሽልማት' : 'Prize pot'}
          </p>
          <div className="flex flex-wrap gap-2">
            {PRIZES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrize(p)}
                className={clsx(
                  'rounded-xl px-3.5 py-2.5 text-xs font-bold transition active:scale-95',
                  prize === p
                    ? 'bg-gradient-to-b from-gold-400 to-gold-500 text-black shadow-md shadow-gold-500/30'
                    : 'bg-white/10 text-white/70 hover:bg-white/15',
                )}
              >
                {formatBirrCompact(p, locale)}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-black/30 p-3 text-center">
            <div>
              <p className="text-[9px] uppercase text-white/35">
                {locale === 'am' ? 'ክፍያ' : 'Fee'}
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold text-equb-400">
                {formatBirrCompact(totalFee || contribution, locale)}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase text-white/35">{t.rooms.players}</p>
              <p className="mt-0.5 font-mono text-sm font-bold">{groupSize}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase text-white/35">{t.rooms.potLabel}</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-gold-400">
                {formatBirrCompact(prize, locale)}
              </p>
            </div>
          </div>
        </section>

        {err && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
            {err}
          </p>
        )}

        <button
          type="button"
          disabled={picks.length === 0 || busy || !user}
          onClick={() => void handleOpenRoom()}
          className="btn-gold relative w-full overflow-hidden disabled:opacity-40"
        >
          {picks.length > 0 && !busy && (
            <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          )}
          {busy ? t.common.opening : t.common.openRoom}
        </button>
      </div>

      {localOpen.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase text-white/30">
            {t.rooms.openRooms}
          </p>
          <div className="space-y-2">
            {localOpen.map((r: LiveRoom) => (
              <Link
                key={r.id}
                href={`/rooms/${r.id}`}
                className="glass block rounded-2xl px-3.5 py-3"
              >
                <div className="flex justify-between">
                  <p className="text-sm font-semibold">
                    {r.groupSize} · {formatBirrCompact(r.prizePool, locale)}
                  </p>
                  <span className="text-[10px] text-white/45">
                    {seatsLeft(r)} left
                  </span>
                </div>
                <SeatNodes
                  total={r.groupSize}
                  taken={takenPicks(r)}
                  yourPick={null}
                  size="sm"
                  maxVisible={20}
                  className="mt-2"
                />
              </Link>
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes shimmer {
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
    </div>
  );
}
