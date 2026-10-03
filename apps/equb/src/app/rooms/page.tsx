'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEqubStore } from '@/lib/store';
import {
  GROUP_SIZES,
  contributionPerMember,
  roomId,
  seatsLeft,
  type LiveRoom,
} from '@/lib/equb-math';
import {
  isMultiplayerEnabled,
  openRoom,
  joinRoom as mpJoin,
  setPlayerName,
} from '@/lib/multiplayer';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { interpolate } from '@/lib/i18n/dictionaries';
import { formatBirrCompact } from '@/lib/money';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';

const PRIZES = [500, 1000, 2000, 5000, 9000];

export default function RoomsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const rooms = useEqubStore((s) => s.rooms);
  const ensureRooms = useEqubStore((s) => s.ensureRooms);
  const user = useEqubStore((s) => s.user);
  const loginDemo = useEqubStore((s) => s.loginDemo);
  const joinLocal = useEqubStore((s) => s.joinRoom);

  const [groupSize, setGroupSize] = useState(10);
  const [pick, setPick] = useState<number | null>(null);
  const [prize, setPrize] = useState(500);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const multiplayer = isMultiplayerEnabled();

  const contribution = useMemo(
    () => contributionPerMember(prize, groupSize),
    [prize, groupSize],
  );
  const templateId = roomId(groupSize, prize);

  useEffect(() => {
    if (!user) loginDemo();
    ensureRooms();
  }, [ensureRooms, user, loginDemo]);

  useEffect(() => {
    setPick(null);
  }, [groupSize]);

  async function handleOpenRoom() {
    if (pick == null) {
      setErr(interpolate(t.rooms.pickFirst, { size: groupSize }));
      return;
    }
    if (!user) loginDemo();
    setBusy(true);
    setErr('');
    try {
      if (multiplayer) {
        const name = user?.name || 'Player';
        setPlayerName(name);
        try {
          await openRoom(templateId);
          await mpJoin(templateId, pick);
          router.push(`/rooms/${templateId}?pick=${pick}`);
          return;
        } catch (apiErr: any) {
          // Fall back to local demo if API fails
          console.warn('API join failed, using local demo', apiErr);
        }
      }
      ensureRooms();
      const res = joinLocal(templateId, pick);
      if (!res.ok) {
        setErr(res.message);
        setBusy(false);
        return;
      }
      router.push(`/rooms/${templateId}`);
    } catch (e: any) {
      setErr(e?.message || t.common.error);
    } finally {
      setBusy(false);
    }
  }

  const openRooms = rooms.filter((r) => r.status === 'open').slice(0, 12);

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl lg:text-3xl">
            {t.rooms.title}
          </h1>
          <p className="mt-1 text-xs text-white/45 sm:text-sm">{t.rooms.subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="mb-1 text-[10px] text-white/40">{t.common.language}</p>
          <LanguageSwitcher />
        </div>
      </div>

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
            <p className="mb-3 text-[11px] text-white/40">{t.rooms.step1Hint}</p>
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
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-equb-500/25 text-[11px] font-bold text-equb-300">
                  2
                </span>
                <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                  {t.rooms.step2}
                </p>
              </div>
              {pick != null && (
                <span className="rounded-full bg-equb-500/20 px-2.5 py-1 font-mono text-xs font-bold text-equb-300">
                  {t.common.selected} · #{String(pick).padStart(2, '0')}
                </span>
              )}
            </div>
            <p className="mb-3 text-[11px] text-white/40">
              {interpolate(t.rooms.step2Hint, { size: String(groupSize).padStart(2, '0') })}
            </p>
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
            <p className="mb-3 text-[11px] text-white/40">{t.rooms.choosePot}</p>
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
            disabled={pick == null || busy}
            onClick={() => void handleOpenRoom()}
            className="btn-gold w-full disabled:opacity-40 disabled:shadow-none"
          >
            {busy ? t.common.opening : t.common.openRoom}
          </button>
          {pick == null && (
            <p className="text-center text-[11px] text-amber-400/90">{t.rooms.needPick}</p>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-24">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white/30">
              {t.rooms.openRooms}
            </p>
            {openRooms.length > 0 ? (
              <div className="space-y-2">
                {openRooms.map((r: LiveRoom) => (
                  <Link
                    key={r.id}
                    href={`/rooms/${r.id}`}
                    className="glass flex items-center justify-between rounded-2xl px-3.5 py-3.5 transition hover:border-equb-500/30 hover:bg-equb-500/5"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {r.groupSize} {t.rooms.players}
                      </p>
                      <p className="mt-0.5 text-xs text-gold-400/90">
                        {formatBirrCompact(r.prizePool, locale)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-white/45">
                        {r.members.length}/{r.groupSize} · {seatsLeft(r)} {t.rooms.left}
                      </span>
                      <ChevronRight className="h-4 w-4 text-white/25" />
                    </div>
                  </Link>
                ))}
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
