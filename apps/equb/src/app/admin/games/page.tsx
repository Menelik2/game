'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatBirrCompact } from '@/lib/money';
import {
  Dice5,
  RefreshCw,
  RotateCcw,
  Timer,
  Users,
  Lock,
  Unlock,
  Trash2,
  UserX,
  Radio,
  Trophy,
  Zap,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';

type Member = {
  playerId: string;
  name: string;
  pick: number;
  picks?: number[];
};

type Room = {
  id: string;
  templateId: string;
  groupSize: number;
  prizePool: number;
  contribution: number;
  status: string;
  members: Member[];
  winningNumber?: number | null;
  winnerName?: string | null;
  secondsLeft?: number;
  playerCount?: number;
  minPlayers?: number;
  maxPlayers?: number;
  joiningClosed?: boolean;
  drawAt?: number;
};

type Summary = {
  total: number;
  open: number;
  drawing: number;
  completed: number;
  totalPlayers: number;
  minPlayers: number;
  roundMs: number;
  dbConfigured: boolean;
};

export default function AdminGamesPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/games');
      const json = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) {
        setMsg({
          type: 'err',
          text: json.message || 'Admin session required — sign in again',
        });
        setRooms([]);
        setLoading(false);
        return;
      }

      if (json.success) {
        setRooms(Array.isArray(json.data?.rooms) ? json.data.rooms : []);
        setSummary(json.data?.summary || null);
        setMsg(null);
      } else {
        setMsg({
          type: 'err',
          text: json.message || 'Failed to load games',
        });
        if (json.data?.rooms) setRooms(json.data.rooms);
        if (json.data?.summary) setSummary(json.data.summary);
      }
    } catch (e) {
      setMsg({
        type: 'err',
        text: e instanceof Error ? e.message : 'Load failed',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 5000);
    return () => clearInterval(iv);
  }, [load]);

  async function act(
    action: string,
    templateId: string,
    extra?: Record<string, unknown>,
  ) {
    setBusy(`${action}:${templateId}`);
    setMsg(null);
    try {
      const res = await adminFetch('/api/admin/games', {
        method: 'POST',
        body: JSON.stringify({ action, templateId, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        setMsg({
          type: 'err',
          text: json.message || `Action failed (${res.status})`,
        });
      } else {
        setMsg({ type: 'ok', text: json.message || 'Done' });
        await load();
      }
    } catch (e) {
      setMsg({
        type: 'err',
        text: e instanceof Error ? e.message : 'Action failed',
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-amber-50">
            <Dice5 className="h-5 w-5 text-amber-400" />
            Games Control
          </h2>
          <p className="mt-1 text-xs text-white/45">
            Live rooms · reset · timer · force draw · kick · min{' '}
            {summary?.minPlayers ?? 5} players to start
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-white/70 hover:border-amber-500/40"
        >
          <RefreshCw className={clsx('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Rooms', value: summary.total, color: 'text-white' },
            { label: 'Open', value: summary.open, color: 'text-equb-300' },
            { label: 'Drawing', value: summary.drawing, color: 'text-amber-300' },
            {
              label: 'Done',
              value: summary.completed,
              color: 'text-white/50',
            },
            {
              label: 'Players',
              value: summary.totalPlayers,
              color: 'text-cyan-300',
            },
            {
              label: 'Min start',
              value: summary.minPlayers,
              color: 'text-gold-300',
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3 text-center"
            >
              <p className="text-[10px] uppercase tracking-wider text-white/40">
                {s.label}
              </p>
              <p className={clsx('mt-1 font-mono text-xl font-black', s.color)}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {summary && !summary.dbConfigured && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Database not configured — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
          in Vercel. Live shared rooms need the equb_live_rooms table.
        </p>
      )}

      {msg && (
        <p
          className={clsx(
            'rounded-xl border px-3 py-2 text-xs',
            msg.type === 'ok'
              ? 'border-equb-500/30 bg-equb-500/10 text-equb-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200',
          )}
        >
          {msg.text}
        </p>
      )}

      {loading && rooms.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading rooms…
        </div>
      )}

      <div className="space-y-3">
        {!loading && rooms.length === 0 && (
          <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-8 text-center text-sm text-white/40">
            No live rooms yet. When players open a room from /rooms, it appears
            here.
          </p>
        )}

        {rooms.map((r) => {
          const key = r.templateId || r.id;
          const pc = r.members?.length || r.playerCount || 0;
          const isExp = expanded === key;
          const busyKey = (a: string) => busy === `${a}:${r.templateId}`;
          const minP = r.minPlayers ?? summary?.minPlayers ?? 5;

          return (
            <div
              key={key}
              className="overflow-hidden rounded-2xl border border-white/10 bg-black/40"
            >
              <button
                type="button"
                onClick={() => setExpanded(isExp ? null : key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">
                      {r.groupSize} ·{' '}
                      {formatBirrCompact(Number(r.prizePool) || 0, 'am')}
                    </span>
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                        r.status === 'open' && 'bg-equb-500/20 text-equb-300',
                        r.status === 'drawing' &&
                          'bg-amber-500/20 text-amber-300',
                        r.status === 'completed' &&
                          'bg-white/10 text-white/45',
                        r.status === 'waiting' &&
                          'bg-sky-500/15 text-sky-300',
                      )}
                    >
                      {r.status}
                    </span>
                    {r.joiningClosed && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] text-red-300">
                        join closed
                      </span>
                    )}
                    {r.status === 'open' && pc < minP && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                        need {minP - pc} more
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-white/40">
                    {r.templateId}
                    {r.winnerName ? ` · winner ${r.winnerName}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-cyan-300">
                    <Users className="h-3.5 w-3.5" />
                    {pc}/{r.groupSize}
                  </span>
                  {r.status === 'open' && (
                    <span className="flex items-center gap-1 font-mono text-amber-300">
                      <Timer className="h-3.5 w-3.5" />
                      {r.secondsLeft ?? '—'}s
                    </span>
                  )}
                  {r.winningNumber != null && (
                    <span className="flex items-center gap-1 text-gold-300">
                      <Trophy className="h-3.5 w-3.5" />#{r.winningNumber}
                    </span>
                  )}
                </div>
              </button>

              {isExp && (
                <div className="space-y-3 border-t border-white/10 px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void act('reset', r.templateId)}
                      className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 disabled:opacity-40"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {busyKey('reset') ? '...' : 'Reset cycle'}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        void act('extend', r.templateId, { seconds: 60 })
                      }
                      className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-200 disabled:opacity-40"
                    >
                      <Timer className="h-3.5 w-3.5" />
                      +60s
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void act('force_draw', r.templateId)}
                      className="flex items-center gap-1.5 rounded-xl border border-gold-500/30 bg-gold-500/15 px-3 py-2 text-xs font-bold text-gold-200 disabled:opacity-40"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {busyKey('force_draw') ? '...' : 'Force draw'}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() =>
                        void act(
                          r.joiningClosed ? 'open_joining' : 'close_joining',
                          r.templateId,
                        )
                      }
                      className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 disabled:opacity-40"
                    >
                      {r.joiningClosed ? (
                        <>
                          <Unlock className="h-3.5 w-3.5" /> Open join
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5" /> Close join
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => {
                        if (confirm('Clear all members from this room?')) {
                          void act('clear_members', r.templateId);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Clear members
                    </button>
                  </div>

                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                      <Radio className="h-3 w-3" />
                      Members ({pc}) · need {minP} to start
                    </p>
                    {(r.members || []).length === 0 && (
                      <p className="text-xs text-white/35">No players yet</p>
                    )}
                    <ul className="space-y-1.5">
                      {(r.members || []).map((m) => (
                        <li
                          key={m.playerId}
                          className="flex items-center justify-between rounded-xl border border-white/5 bg-black/30 px-3 py-2 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-white">
                              {m.name}
                            </span>
                            <span className="ml-2 font-mono text-white/40">
                              #{(m.picks || [m.pick]).join(', #')}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={!!busy}
                            onClick={() =>
                              void act('kick', r.templateId, {
                                playerId: m.playerId,
                              })
                            }
                            className="flex items-center gap-1 rounded-lg border border-red-500/25 px-2 py-1 text-[10px] font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                          >
                            <UserX className="h-3 w-3" />
                            Kick
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
