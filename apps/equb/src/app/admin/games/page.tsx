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
  Ban,
  DoorOpen,
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
  contribution?: number;
  status: string;
  members?: Member[];
  playerCount?: number;
  secondsLeft?: number;
  winningNumber?: number | null;
  winnerName?: string | null;
  adminClosed?: boolean;
  joiningClosed?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  gameId?: string;
};

type Summary = {
  total: number;
  open: number;
  drawing: number;
  completed: number;
  totalPlayers: number;
  minPlayers: number;
  roundMs: number;
  dbConfigured?: boolean;
};

export default function AdminGamesPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/games');
      const json = await res.json();
      if (json.success) {
        setRooms(json.data?.rooms || []);
        setSummary(json.data?.summary || null);
        setMsg('');
      } else {
        setMsg(json.message || 'Failed to load');
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Load failed');
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
    setBusy(`${action}:${templateId || 'all'}`);
    setMsg('');
    try {
      const res = await adminFetch('/api/admin/games', {
        method: 'POST',
        body: JSON.stringify({ action, templateId, ...extra }),
      });
      const json = await res.json();
      setMsg(json.message || (json.success ? 'OK' : 'Failed'));
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  const busyKey = (action: string) =>
    busy?.startsWith(`${action}:`) ? true : false;

  const minP = summary?.minPlayers ?? 5;

  return (
    <div className="space-y-4 pb-16">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-black text-white">
          <Dice5 className="h-6 w-6 text-amber-400" />
          Games Control
        </h1>
        <p className="mt-1 text-xs text-white/45">
          Close open rooms · delete closed · reopen · reset · force draw · min{' '}
          {minP} players to start
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => {
            if (
              confirm(
                'Close ALL open/drawing rooms? Players cannot join until reopened.',
              )
            ) {
              void act('close_all', '');
            }
          }}
          className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-40"
        >
          <Ban className="h-3.5 w-3.5" />
          Close all open
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => {
            if (
              confirm(
                'Delete ALL closed/completed rooms from the database? This cannot be undone.',
              )
            ) {
              void act('delete_all_closed', '');
            }
          }}
          className="flex items-center gap-1.5 rounded-xl border border-red-600/50 bg-red-700/30 px-3 py-2 text-xs font-bold text-red-100 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete all closed
        </button>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-white/70 hover:border-amber-500/40"
        >
          <RefreshCw
            className={clsx('h-3.5 w-3.5', loading && 'animate-spin')}
          />
          Refresh
        </button>
      </div>

      {msg && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {msg}
        </p>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(
            [
              ['ROOMS', summary.total, 'text-white'],
              ['OPEN', summary.open, 'text-equb-300'],
              ['DRAWING', summary.drawing, 'text-amber-300'],
              ['DONE', summary.completed, 'text-white/50'],
              ['PLAYERS', summary.totalPlayers, 'text-cyan-300'],
              ['MIN START', summary.minPlayers, 'text-gold-300'],
            ] as const
          ).map(([label, val, color]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-center"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                {label}
              </p>
              <p className={clsx('mt-1 font-mono text-2xl font-black', color)}>
                {val}
              </p>
            </div>
          ))}
        </div>
      )}

      {loading && rooms.length === 0 && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
        </div>
      )}

      <div className="space-y-2">
        {rooms.map((r) => {
          const pc = r.members?.length || r.playerCount || 0;
          const isExp = expanded === r.templateId;
          return (
            <div
              key={r.templateId || r.id}
              className="overflow-hidden rounded-2xl border border-white/10 bg-black/35"
            >
              <button
                type="button"
                onClick={() =>
                  setExpanded(isExp ? null : r.templateId)
                }
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-white">
                      {r.groupSize} · {formatBirrCompact(r.prizePool)}
                    </span>
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                        r.status === 'open' && !r.adminClosed
                          ? 'bg-equb-500/25 text-equb-200'
                          : r.status === 'drawing'
                            ? 'bg-amber-500/25 text-amber-200'
                            : 'bg-white/10 text-white/50',
                      )}
                    >
                      {r.status}
                    </span>
                    {r.adminClosed && (
                      <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-200">
                        Closed by admin
                      </span>
                    )}
                    {r.joiningClosed && !r.adminClosed && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/40">
                        join closed
                      </span>
                    )}
                    {r.status === 'open' && !r.adminClosed && pc < minP && (
                      <span className="text-[10px] text-amber-300/80">
                        need {minP - pc} more
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-white/35">
                    {r.templateId}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                  <span className="flex items-center gap-1 text-white/60">
                    <Users className="h-3.5 w-3.5" />
                    {pc}/{r.groupSize}
                  </span>
                  {r.status === 'open' && !r.adminClosed && (
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
                    {r.adminClosed ? (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => void act('reopen', r.templateId)}
                        className="flex items-center gap-1.5 rounded-xl border border-equb-500/40 bg-equb-500/20 px-3 py-2 text-xs font-bold text-equb-200 disabled:opacity-40"
                      >
                        <DoorOpen className="h-3.5 w-3.5" />
                        {busyKey('reopen') ? '...' : 'Reopen room'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => {
                          if (
                            confirm(
                              'Close this game? Players cannot join until you reopen it.',
                            )
                          ) {
                            void act('close', r.templateId);
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-600/25 px-3 py-2 text-xs font-bold text-red-100 disabled:opacity-40"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        {busyKey('close') ? '...' : 'Close game'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => {
                        if (
                          confirm(
                            `Delete room ${r.templateId} permanently from the database?`,
                          )
                        ) {
                          void act('delete', r.templateId);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-red-700/50 bg-red-900/40 px-3 py-2 text-xs font-bold text-red-100 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {busyKey('delete') ? '...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || !!r.adminClosed}
                      onClick={() => void act('reset', r.templateId)}
                      className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 disabled:opacity-40"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {busyKey('reset') ? '...' : 'Reset cycle'}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || !!r.adminClosed}
                      onClick={() => void act('extend', r.templateId, { seconds: 60 })}
                      className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 disabled:opacity-40"
                    >
                      <Timer className="h-3.5 w-3.5" />
                      +60s
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || !!r.adminClosed}
                      onClick={() => void act('force_draw', r.templateId)}
                      className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100 disabled:opacity-40"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      {busyKey('force_draw') ? '...' : 'Force draw'}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || !!r.adminClosed}
                      onClick={() =>
                        void act(
                          r.joiningClosed ? 'open_joining' : 'close_joining',
                          r.templateId,
                        )
                      }
                      className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 disabled:opacity-40"
                    >
                      {r.joiningClosed ? (
                        <Unlock className="h-3.5 w-3.5" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                      {r.joiningClosed ? 'Open join' : 'Close join'}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => {
                        if (confirm('Clear all players from this room?')) {
                          void act('clear_members', r.templateId);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 disabled:opacity-40"
                    >
                      <UserX className="h-3.5 w-3.5" />
                      Clear players
                    </button>
                  </div>

                  {(r.members?.length || 0) > 0 && (
                    <ul className="space-y-1 rounded-xl border border-white/5 bg-black/30 p-2">
                      {(r.members || []).map((m) => (
                        <li
                          key={m.playerId}
                          className="flex items-center justify-between px-2 py-1 text-xs"
                        >
                          <span className="text-white/80">{m.name}</span>
                          <span className="font-mono text-amber-300">
                            #{(m.picks || [m.pick]).join(', #')}
                          </span>
                          <button
                            type="button"
                            className="text-[10px] text-red-300"
                            onClick={() =>
                              void act('kick', r.templateId, {
                                playerId: m.playerId,
                              })
                            }
                          >
                            Kick
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {!loading && rooms.length === 0 && (
          <p className="py-12 text-center text-sm text-white/40">
            No live rooms in database yet. Players open rooms from /rooms.
          </p>
        )}
      </div>
    </div>
  );
}
