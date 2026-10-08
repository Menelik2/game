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
        setPlayerName(user.name);
        try {
          await openRoom(templateId, user.id);
          await mpJoin(templateId, user.id, picks);
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">
            {t.rooms.title}
          </h1>
          <p className="text-xs text-white/45">{t.rooms.subtitle}</p>
        </div>
        <LanguageSwitcher />
      </div>

      {multiplayer && liveOk && liveOpen.length > 0 && (
        <section className="glass rounded-2xl p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-equb-300">
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {locale === 'am' ? 'ክፍት ክፍሎች' : 'Open rooms'}
          </p>
          <div className="space-y-2">
            {liveOpen.slice(0, 8).map((r) => (
              <Link
                key={r.id}
                href={`/rooms/${encodeURIComponent(r.templateId || r.id)}`}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 transition hover:border-equb-500/40"
              >
                <div>
                  <p className="text-sm font-bold">
                    {r.groupSize} {t.rooms.players} ·{' '}
                    {formatBirrCompact(r.prizePool, locale)}
                  </p>
                  <p className="text-[10px] text-white/40">
                    {locale === 'am'
                      ? `ከፍተኛ ${maxPicksForGroup(r.groupSize)} ቁጥር / ተጫዋች`
                      : `max ${maxPicksForGroup(r.groupSize)} picks / player`}
                  </p>
                </div>
                <SeatRing
                  total={r.groupSize}
                  taken={r.members?.length || 0}
                  maxVisible={Math.min(r.groupSize, 20)}
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {templates.length > 0 && (
        <section className="glass rounded-2xl p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
            {locale === 'am' ? 'ቅርጸቶች' : 'Templates'}
          </p>
          <div className="flex flex-wrap gap-2">
            {templates.slice(0, 12).map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setGroupSize(tpl.groupSize);
                  setPrize(tpl.prizePool);
                }}
                className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs"
              >
                {tpl.groupSize} · {formatBirrCompact(tpl.prizePool, locale)}
              </button>
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
          <p className="mb-2 text-[11px] text-white/40">
            {locale === 'am'
              ? 'ክፍል የሚቀላቀሉ ተጫዋቾች ብዛት'
              : 'How many players can join this room'}
          </p>
          <div className="flex flex-wrap gap-2">
            {GROUP_SIZES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupSize(g)}
                className={clsx(
                  'flex min-w-[2.75rem] items-center justify-center rounded-xl px-3 py-2.5 transition active:scale-95',
                  groupSize === g ? 'chip-active ring-1 ring-equb-500/40' : 'chip',
                )}
              >
                <span className="text-sm font-bold">{g}</span>
              </button>
            ))}
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
          <SeatNodes
            total={groupSize}
            selected={picks}
            onToggle={togglePick}
          />
          <div
            className="mt-3 grid gap-2"
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
                    'aspect-square rounded-xl text-sm font-black transition active:scale-95',
                    on && 'tile-selected text-white',
                    !on && !locked && 'tile text-white/80',
                    locked && 'cursor-not-allowed tile-taken text-white/25',
                  )}
                >
                  {String(n).padStart(2, '0')}
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass rounded-2xl p-4 sm:p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">
            3 · {locale === 'am' ? 'ሽልማት' : 'Prize'}
          </p>
          <div className="flex flex-wrap gap-2">
            {PRIZES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrize(p)}
                className={clsx(
                  'rounded-xl px-3 py-2 text-sm font-bold transition',
                  prize === p ? 'chip-active' : 'chip',
                )}
              >
                {formatBirrCompact(p, locale)}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-black/30 p-2">
              <p className="text-white/40">{locale === 'am' ? 'ቡድን' : 'Group'}</p>
              <p className="mt-0.5 font-mono text-sm font-bold">{groupSize}</p>
            </div>
            <div className="rounded-xl bg-black/30 p-2">
              <p className="text-white/40">{locale === 'am' ? 'አስተዋጽዖ' : 'Fee'}</p>
              <p className="mt-0.5 font-mono text-sm font-bold">
                {formatBirrCompact(contribution, locale)}
              </p>
            </div>
            <div className="rounded-xl bg-black/30 p-2">
              <p className="text-white/40">{locale === 'am' ? 'ድምር' : 'Total'}</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-gold-300">
                {formatBirrCompact(totalFee, locale)}
              </p>
            </div>
          </div>
        </section>

        {err && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
            {err}
          </p>
        )}

        <button
          type="button"
          disabled={busy || picks.length === 0}
          onClick={() => void handleOpenRoom()}
          className="btn-gold flex w-full items-center justify-center gap-2 py-3.5 text-base disabled:opacity-40"
        >
          {busy
            ? '...'
            : locale === 'am'
              ? 'ክፍል ክፈት / ተቀላቀል'
              : 'Open / Join room'}
          <ChevronRight className="h-5 w-5" />
        </button>

        {rooms.filter((r) => r.members.length > 0).length > 0 && (
          <section className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-white/40">
              {locale === 'am' ? 'የአካባቢ ክፍሎች' : 'Local rooms'}
            </p>
            {rooms
              .filter((r) => r.members.length > 0)
              .map((r) => (
                <Link
                  key={r.id}
                  href={`/rooms/${encodeURIComponent(r.id)}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 py-2"
                >
                  <span className="text-sm">
                    {r.groupSize} · {formatBirrCompact(r.prizePool, locale)}
                  </span>
                  <SeatRing total={r.groupSize} taken={r.members.length} />
                </Link>
              ))}
          </section>
        )}
      </div>
    </div>
  );
}
