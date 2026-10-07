'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { EqubTable, type TablePlayer } from '@/components/EqubTable';
import { maxPicksForGroup, validatePicks } from '@/lib/equb-math';
import {
  fetchRoom,
  joinRoomWithBalance,
  openRoom,
  getPlayerIdentity,
  type ServerRoom,
} from '@/lib/multiplayer';
import { useEqubStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n/LanguageContext';

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const templateId = id?.match(/^equb-\d+-\d+/)?.[0] || id;
  const { locale } = useI18n();
  const user = useEqubStore((s) => s.user);
  const setSessionUser = useEqubStore((s) => s.setSessionUser);
  const [room, setRoom] = useState<ServerRoom | null>(null);
  const [picks, setPicks] = useState<number[]>([]);
  const [msg, setMsg] = useState('');
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!templateId) return;
    let stop = false;
    const load = async () => {
      try {
        const next = await fetchRoom(templateId).catch(() => openRoom(templateId));
        if (!stop) {
          setRoom(next);
          setErr('');
        }
      } catch (e) {
        if (!stop) setErr(e instanceof Error ? e.message : 'Room unavailable');
      }
    };
    void load();
    const iv = setInterval(() => void load(), 2500);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [templateId]);

  const playerId = user?.id || getPlayerIdentity().playerId;
  const me = room?.members.find((m) => m.playerId === playerId);
  const yours = me?.picks?.length ? me.picks : me?.pick != null ? [me.pick] : [];
  const taken = new Set<number>();
  for (const m of room?.members || []) {
    const list = m.picks?.length ? m.picks : m.pick != null ? [m.pick] : [];
    for (const n of list) taken.add(Number(n));
  }
  const maxP = room ? maxPicksForGroup(room.groupSize) : 1;
  const players: TablePlayer[] = (room?.members || []).map((m) => ({
    id: m.playerId,
    name: m.name,
    pick: m.pick,
    picks: m.picks?.length ? m.picks : [m.pick],
    isYou: m.playerId === playerId,
    status:
      room?.status === 'completed'
        ? m.playerId === room.winnerId
          ? 'won'
          : 'lost'
        : 'waiting',
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-3 pb-28 sm:pb-8">
      {err && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-200">
          {err}
        </p>
      )}
      {!room && !err && (
        <p className="py-12 text-center text-sm text-white/40">
          {locale === 'am' ? 'ክፍል በመጫን ላይ…' : 'Loading room…'}
        </p>
      )}
      {room && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <p className="text-sm font-bold text-white">
                {room.groupSize}{' '}
                {locale === 'am' ? 'ተጫዋቾች' : 'players'} ·{' '}
                <span className="text-gold-400">{room.prizePool} Birr</span>
              </p>
              <p className="text-[11px] text-white/45">
                {locale === 'am'
                  ? `ከፍተኛ ${maxP} ቁጥር · ክፍያ ${room.contribution} ብር / ቁጥር`
                  : `Max ${maxP} picks · ${room.contribution} Birr / number`}
              </p>
            </div>
            <Link
              href="/rooms"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70"
            >
              {locale === 'am' ? 'ተመለስ' : 'Back'}
            </Link>
          </div>
          <EqubTable
            groupSize={room.groupSize}
            prizePool={room.prizePool}
            contribution={room.contribution}
            taken={taken}
            selected={yours.length ? yours : picks}
            yourPicks={yours}
            winningNumber={room.winningNumber}
            status={room.status}
            players={players}
            results={
              (
                room as ServerRoom & {
                  recent?: {
                    winningNumber: number;
                    winnerName: string;
                    pot: number;
                    id?: string;
                  }[];
                }
              ).recent || []
            }
            secondsLeft={Number(room.secondsLeft ?? 60)}
            lastWinnerPayout={room.winnerPayout}
            lastAdminFee={room.adminFee}
            disabled={yours.length > 0 || room.status !== 'open' || joining}
            joining={joining}
            canBet={
              room.status === 'open' &&
              yours.length === 0 &&
              picks.length > 0 &&
              !joining
            }
            maxSelect={maxP}
            onToggleSelect={(n) => {
              if (yours.length || room.status !== 'open') return;
              if (taken.has(n)) return;
              setPicks((prev) => {
                if (prev.includes(n)) return prev.filter((x) => x !== n);
                if (prev.length >= maxP) {
                  setMsg(
                    locale === 'am'
                      ? `ከፍተኛ ${maxP} ቁጥር ብቻ`
                      : `Max ${maxP} number(s)`,
                  );
                  return prev;
                }
                setMsg('');
                return [...prev, n].sort((a, b) => a - b);
              });
            }}
            onBet={async () => {
              if (!user) {
                setMsg(locale === 'am' ? 'መጀመሪያ ይግቡ' : 'Sign in first');
                return;
              }
              const check = validatePicks(room.groupSize, picks, taken);
              if (!check.ok) {
                setMsg(check.message);
                return;
              }
              const feeNeed =
                Math.round(Number(room.contribution) * check.picks.length * 100) /
                100;
              if (feeNeed > 0 && Number(user.balance || 0) < feeNeed) {
                setMsg(
                  locale === 'am'
                    ? `በቂ ብር የለም (ያስፈልጋል ${feeNeed}) — ወደ ኪስ ይሂዱና ቴሌብር ያስገቡ`
                    : `Need ${feeNeed} Birr — deposit Telebirr in Wallet first`,
                );
                return;
              }
              setJoining(true);
              try {
                const { room: joined, balance, fee } = await joinRoomWithBalance(
                  templateId!,
                  check.picks,
                );
                setRoom(joined);
                if (typeof balance === 'number')
                  setSessionUser({ ...user, balance });
                setPicks([]);
                setMsg(
                  locale === 'am'
                    ? `ተቀላቅለዋል · -${fee ?? feeNeed} ብር`
                    : `Joined · -${fee ?? feeNeed} Birr`,
                );
              } catch (e) {
                const m = e instanceof Error ? e.message : 'Join failed';
                setMsg(m);
              } finally {
                setJoining(false);
              }
            }}
          />
        </>
      )}
      {msg && (
        <div className="space-y-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-equb-300">
          <p>{msg}</p>
          {/insufficient|በቂ ብር|Need \d|deposit|ተሞላ|ኪስ/i.test(msg) && (
            <Link
              href="/wallet"
              className="inline-block rounded-full bg-amber-400 px-4 py-1.5 text-[11px] font-bold text-black"
            >
              {locale === 'am' ? 'ወደ ኪስ · ቴሌብር አስገባ' : 'Open Wallet · Deposit'}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
