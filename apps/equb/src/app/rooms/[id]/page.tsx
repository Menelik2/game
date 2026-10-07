'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
    const iv = setInterval(() => void load(), 3000);
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
    <div className="space-y-2 pb-4">
      <Link href="/rooms" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
        <ArrowLeft className="h-3.5 w-3.5" />
        {locale === 'am' ? 'ተመለስ' : 'Back'}
      </Link>
      {!room ? (
        <p className="py-6 text-center text-sm text-white/50">
          {err || (locale === 'am' ? 'ክፍል በመገናት ላይ ነው' : 'Opening room...')}
        </p>
      ) : (
        <>
          {room.status === 'completed' && room.winnerName && (
            <p className="rounded-xl bg-amber-400/15 px-3 py-2 text-center text-sm font-semibold text-amber-200">
              {locale === 'am' ? 'አሻኛ' : 'Winner'}: {room.winnerName} · #
              {String(room.winningNumber).padStart(2, '0')}
              {room.winnerPayout != null ? ` · +${room.winnerPayout}` : ''}
            </p>
          )}
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
            results={(room as ServerRoom & { recent?: { winningNumber: number; winnerName: string; pot: number; id?: string }[] }).recent || []}
            secondsLeft={Number(room.secondsLeft ?? 60)}
            lastWinnerPayout={room.winnerPayout}
            lastAdminFee={room.adminFee}
            disabled={yours.length > 0 || room.status !== 'open' || joining}
            joining={joining}
            canBet={room.status === 'open' && yours.length === 0 && picks.length > 0 && !joining}
            maxSelect={maxP}
            onToggleSelect={(n) => {
              if (yours.length || room.status !== 'open') return;
              if (taken.has(n)) return;
              setPicks((prev) => {
                if (prev.includes(n)) return prev.filter((x) => x !== n);
                if (prev.length >= maxP) return [...prev.slice(1), n].sort((a, b) => a - b);
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
              setJoining(true);
              try {
                const { room: joined, balance, fee } = await joinRoomWithBalance(templateId!, check.picks);
                setRoom(joined);
                if (typeof balance === 'number') setSessionUser({ ...user, balance });
                setPicks([]);
                setMsg(
                  locale === 'am'
                    ? `ተቀላቅለዋል · -${fee ?? room.contribution} ብር`
                    : `Joined · -${fee ?? room.contribution} Birr`,
                );
              } catch (e) {
                setMsg(e instanceof Error ? e.message : 'Join failed');
              } finally {
                setJoining(false);
              }
            }}
          />
        </>
      )}
      {msg && <p className="rounded-lg bg-white/5 px-3 py-2 text-center text-xs text-equb-300">{msg}</p>}
    </div>
  );
}
