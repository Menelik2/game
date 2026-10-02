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
import clsx from 'clsx';

const PRIZES = [500, 1000, 2000, 5000, 9000];

/** Flow: pick size 5–100 → pick number → open room seat nodes */
export default function RoomsPage() {
  const router = useRouter();
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
    ensureRooms();
  }, [ensureRooms]);

  useEffect(() => {
    setPick(null);
  }, [groupSize]);

  async function handleOpenRoom() {
    if (pick == null) {
      setErr(`Pick your number first (1–${groupSize})`);
      return;
    }
    if (!user) loginDemo();
    setBusy(true);
    setErr('');
    try {
      if (multiplayer) {
        if (user?.name) setPlayerName(user.name);
        await openRoom(templateId);
        await mpJoin(templateId, pick);
        router.push(`/rooms/${templateId}?pick=${pick}`);
      } else {
        ensureRooms();
        const res = joinLocal(templateId, pick);
        if (!res.ok) {
          setErr(res.message);
          setBusy(false);
          return;
        }
        router.push(`/rooms/${templateId}`);
      }
    } catch (e: any) {
      setErr(e?.message || 'Could not open room');
    } finally {
      setBusy(false);
    }
  }

  const openRooms = rooms.filter((r) => r.status === 'open').slice(0, 12);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="keno-title">FAST EQUB</h1>
          <p className="text-[11px] text-white/40">Pick size · pick number · open room</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/40">Balance</p>
          <p className="font-mono text-sm font-bold text-equb-400">
            {user ? user.balance.toLocaleString() : '—'}
          </p>
        </div>
      </div>

      <section className="glass rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gold-400/80">
          1 · Players in room
        </p>
        <p className="mt-1 text-[11px] text-white/45">Choose group size (5 to 100)</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {GROUP_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setGroupSize(s)}
              className={clsx(
                'min-w-[2.75rem] rounded-xl px-2.5 py-2 text-xs font-bold',
                groupSize === s
                  ? 'bg-gold-500 text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/15',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <section className="glass rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gold-400/80">
          2 · Your number
        </p>
        <p className="mt-1 text-[11px] text-white/45">
          Pick 01–{String(groupSize).padStart(2, '0')} <strong>before</strong> the room opens
        </p>
        <div
          className="mt-3 grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${groupSize <= 20 ? 5 : 10}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: groupSize }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPick(n)}
              className={clsx(
                'aspect-square rounded-lg text-[10px] font-bold sm:text-xs',
                pick === n
                  ? 'bg-equb-500 text-white ring-2 ring-equb-300'
                  : 'bg-surface-800 text-white/70 hover:bg-white/15',
              )}
            >
              {String(n).padStart(2, '0')}
            </button>
          ))}
        </div>
        {pick != null && (
          <p className="mt-2 text-center text-sm font-semibold text-equb-400">
            Selected · #{String(pick).padStart(2, '0')}
          </p>
        )}
      </section>

      <section className="glass rounded-2xl p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gold-400/80">
          3 · Prize pot
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRIZES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrize(p)}
              className={clsx(
                'rounded-xl px-3 py-2 text-xs font-bold',
                prize === p
                  ? 'bg-gold-500 text-black'
                  : 'bg-white/10 text-white/70 hover:bg-white/15',
              )}
            >
              {p.toLocaleString()}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-white/50">
          Entry each: <span className="font-bold text-equb-400">{contribution}</span> Birr ·{' '}
          {groupSize} players · pot{' '}
          <span className="text-gold-400">{prize.toLocaleString()}</span>
        </p>
      </section>

      {err && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>
      )}

      <button
        type="button"
        disabled={pick == null || busy}
        onClick={() => void handleOpenRoom()}
        className="w-full rounded-2xl bg-gold-500 py-4 text-sm font-black text-black disabled:opacity-40"
      >
        {busy ? 'OPENING…' : 'OPEN ROOM · SHOW SEAT NODES'}
      </button>

      {openRooms.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-white/30">
            Open rooms
          </p>
          <div className="space-y-2">
            {openRooms.map((r: LiveRoom) => (
              <Link
                key={r.id}
                href={`/rooms/${r.id}`}
                className="glass flex items-center justify-between rounded-xl px-3 py-3 text-sm"
              >
                <span>
                  {r.groupSize}p · {r.prizePool.toLocaleString()} Birr
                </span>
                <span className="text-xs text-white/40">
                  {r.members.length}/{r.groupSize} · {seatsLeft(r)} left
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
