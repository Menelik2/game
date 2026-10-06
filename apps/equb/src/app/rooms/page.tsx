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
import { interpolate } from '@/lib/i18n/dictionaries';
import { formatBirrCompact } from '@/lib/money';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SeatNodes, SeatRing } from '@/components/SeatNodes';
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
  const [pick, setPick] = useState<number | null>(null);
  const [prize, setPrize] = useState(500);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [liveOpen, setLiveOpen] = useState<ServerRoom[]>([]);
  const [templates, setTemplates] = useState<LiveTemplate[]>([]);
  const [liveOk, setLiveOk] = useState(false);
  const multiplayer = isMultiplayerEnabled();

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
    // Never auto-login as demo — that was wiping real sessions on refresh
    ensureRooms();
  }, [ensureRooms]);

  useEffect(() => {
    void refreshLive();
    const iv = setInterval(() => void refreshLive(), 3000);
    return () => clearInterval(iv);
  }, [refreshLive]);

  useEffect(() => {
    setPick(null);
  }, [groupSize]);

  function openLocalRoom(chosenPick: number): boolean {
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
    const res = joinLocal(templateId, chosenPick);
    if (!res.ok) {
      setErr(res.message);
      return false;
    }
    return true;
  }

  async function handleOpenRoom() {
    if (pick == null) {
      setErr(interpolate(t.rooms.pickFirst, { size: groupSize }));
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
        const name = user?.name || 'Player';
        setPlayerName(name);
        try {
          await openRoom(templateId);
          await mpJoin(templateId, pick);
          clearTimeout(safety);
          setBusy(false);
          router.push(`/rooms/${templateId}?pick=${pick}`);
          return;
        } catch (apiErr: unknown) {
          console.warn('API open/join failed — local room', apiErr);
        }
      }

      const ok = openLocalRoom(pick);
      clearTimeout(safety);
      setBusy(false);
      if (ok) router.push(`/rooms/${templateId}`);
    } catch (e: unknown) {
      clearTimeout(safety);
      setBusy(false);
      if (openLocalRoom(pick)) {
        router.push(`/rooms/${templateId}`);
      } else {
        setErr(e instanceof Error ? e.message : t.common.error);
      }
    }
  }

  const localOpen = rooms
    .filter((r) => r.status === 'open' && r.members.length > 0)
    .slice(0, 12);
  const previewTaken = pick != null ? new Set([pick]) : new Set<number>();
  const activeTemplates = templates.filter(
    (t) => t.status === 'open' && t.seatsTaken > 0,
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
              {locale === 'am' ? 'ቀጥታ ክፍሎች · አብረው ይጫወቱ' : 'Live rooms · play together'}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="mb-1 text-[10px] text-white/40">{t.common.language}</p>
          <LanguageSwitcher />
        </div>
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
              {locale === 'am' ? 'ክፍት ክፍሎች · አሁን ይቀላቀሉ' : 'Open rooms · join now'}
            </h2>
          </div>
          <div className="space-y-2">
            {liveOpen.map((r) => {
              const taken = new Set(r.members.map((m) => m.pick));
              const left = Math.max(0, r.groupSize - r.members.length);
              const href = r.templateId
                ? `/rooms/${r.templateId}`
                : `/rooms/${r.id}`;
              return (
                <Link
                  key={r.id}
                  href={href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3 transition hover:border-equb-400/40"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {r.groupSize} {t.rooms.players} ·{' '}
                      <span className="text-gold-400">
                        {formatBirrCompact(r.prizePool, locale)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/45">
                      {r.members.length}/{r.groupSize} · {left}{' '}
                      {locale === 'am' ? 'መቀመጫ ቀርቷል' : 'seats left'}
                    </p>
                    <div className="mt-2">
                      <SeatNodes
                        total={r.groupSize}
                        taken={taken}
                        yourPick={null}
                        size="sm"
                        maxVisible={Math.min(r.groupSize, 20)}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-equb-500 px-3 py-1.5 text-[11px] font-bold text-white">
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
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {tpl.groupSize} {t.rooms.players} ·{' '}
                      <span className="text-gold-400">
                        {formatBirrCompact(tpl.prizePool, locale)}
                      </span>
                    </p>
                    <p className="text-[11px] text-white/45">
                      {tpl.seatsTaken}/{tpl.groupSize} seated
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30" />
                </Link>
              ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-5 lg:gap-8">
        <div className="space-y-5 lg:col-span-3">
          <section className="glass rounded-2xl p-4 sm:p-5">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-equb-500/25 text-[11px] font-bold text-equb-300">
                1
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                {t.rooms.step1}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {GROUP_SIZES.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroupSize(g)}
                  className={clsx(
                    'min-w-[2.75rem] rounded-xl px-3 py-2 text-sm font-bold transition active:scale-95',
                    groupSize === g ? 'chip-active ring-1 ring-equb-500/40' : 'chip',
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-4 sm:p-5">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-equb-500/25 text-[11px] font-bold text-equb-300">
                2
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                {t.rooms.step2}
              </p>
            </div>
            <div className="mb-3 flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/25 p-3">
              <SeatRing
                total={groupSize}
                filledCount={pick != null ? 1 : 0}
                yourPick={pick}
                taken={previewTaken}
              />
              <SeatNodes
                total={groupSize}
                taken={previewTaken}
                yourPick={pick}
                size="md"
                maxVisible={groupSize}
                className="justify-center"
              />
            </div>
            <div
              className="grid gap-1.5"
              style={{
                gridTemplateColumns: `repeat(${Math.min(groupSize <= 20 ? 5 : 10, groupSize)}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: groupSize }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPick(n)}
                  className={clsx(
                    'aspect-square rounded-lg text-[11px] font-bold transition active:scale-95 sm:text-xs',
                    pick === n
                      ? 'bg-equb-500 text-white shadow-md shadow-equb-500/30 ring-2 ring-equb-300/50'
                      : 'bg-[#151c1a] text-white/75 hover:bg-white/10',
                  )}
                >
                  {String(n).padStart(2, '0')}
                </button>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-4 sm:p-5">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-500/25 text-[11px] font-bold text-gold-400">
                3
              </span>
              <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                {t.rooms.step3}
              </p>
            </div>
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
                <p className="text-[9px] uppercase text-white/35">{t.rooms.entryEach}</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-equb-400">
                  {formatBirrCompact(contribution, locale)}
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase text-white/35">{t.rooms.players}</p>
                <p className="mt-0.5 font-mono text-sm font-bold text-white">{groupSize}</p>
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
            disabled={pick == null || busy || !user}
            onClick={() => void handleOpenRoom()}
            className="btn-gold w-full disabled:opacity-40 disabled:shadow-none"
          >
            {busy ? t.common.opening : t.common.openRoom}
          </button>
        </div>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-24">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
              {t.rooms.openRooms}
            </p>
            {localOpen.length > 0 ? (
              <div className="space-y-2">
                {localOpen.map((r: LiveRoom) => {
                  const taken = takenPicks(r);
                  const yours = user
                    ? r.members.find((m) => m.id === user.id)?.pick ?? null
                    : null;
                  return (
                    <Link
                      key={r.id}
                      href={`/rooms/${r.id}`}
                      className="glass block rounded-2xl px-3.5 py-3.5 transition hover:border-equb-500/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {r.groupSize} {t.rooms.players}
                          </p>
                          <p className="mt-0.5 text-xs text-gold-400/90">
                            {formatBirrCompact(r.prizePool, locale)}
                          </p>
                        </div>
                        <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-white/45">
                          {r.members.length}/{r.groupSize} · {seatsLeft(r)}{' '}
                          {t.rooms.left}
                        </span>
                      </div>
                      <div className="mt-2.5 border-t border-white/5 pt-2.5">
                        <SeatNodes
                          total={r.groupSize}
                          taken={taken}
                          yourPick={yours}
                          size="sm"
                          maxVisible={r.groupSize <= 20 ? r.groupSize : 20}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="glass rounded-2xl p-6 text-center text-sm text-white/35">
                {t.rooms.emptyOpen}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
