'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buildRoomCatalog,
  type LiveRoom,
  type EqubMember,
  isFull,
  takenPicks,
  numberPool,
  splitPot,
  ADMIN_FEE_RATE,
} from './equb-math';
import { cryptographicDraw, secureRandomInt } from './crypto-rng';
import { msg } from './i18n/messages';
import {
  updateLocalBalance,
  getAccountById,
  tryDebitAccount,
  creditAccount,
} from './auth-local';

export type User = {
  id: string;
  name: string;
  phone?: string;
  email: string;
  balance: number;
  referralCode: string;
  referredBy?: string;
  role?: 'player' | 'admin';
  banned?: boolean;
};

type HistoryEvent = {
  roomId: string;
  winningNumber: number;
  winnerName: string;
  amount: number;
  winnerPayout: number;
  adminFee: number;
  wasYou: boolean;
  at: number;
  entropyHex?: string;
  commitmentHash?: string;
};

type AdminFeeEvent = {
  roomId: string;
  grossPot: number;
  adminFee: number;
  winnerPayout: number;
  winnerName: string;
  at: number;
};

type State = {
  user: User | null;
  rooms: LiveRoom[];
  history: HistoryEvent[];
  adminEarningsTotal: number;
  adminFeeLog: AdminFeeEvent[];
  setSessionUser: (user: User) => void;
  loginDemo: (name?: string) => void;
  logout: () => void;
  ensureRooms: () => void;
  joinRoom: (roomId: string, pick: number) => { ok: boolean; message: string };
  fillSeats: (roomId: string) => { ok: boolean; message: string };
  runDraw: (roomId: string) => Promise<{ ok: boolean; message: string }>;
  reopenRoom: (roomId: string) => { ok: boolean; message: string };
  claimReferral: (code: string) => { ok: boolean; message: string };
  adjustBalance: (delta: number) => { ok: boolean; message: string; balance?: number };
  refreshBalance: () => void;
};

const BOT_NAMES = ['አበበ', 'ትግስት', 'ከበደ', 'ሐና', 'ዮናስ', 'ማርታ', 'ዳዊት', 'ሳራ'];

function catalogToRooms(): LiveRoom[] {
  return buildRoomCatalog({ maxPrize: 9000 }).map((t) => ({
    id: t.id,
    groupSize: t.groupSize as number,
    prizePool: t.prizePool,
    contribution: t.contribution,
    tier: t.tier,
    status: 'open' as const,
    members: [],
    winningNumber: null,
    winnerId: null,
  }));
}

function freshRound(room: LiveRoom): LiveRoom {
  return {
    ...room,
    members: [],
    status: 'open',
    winningNumber: null,
    winnerId: null,
    lastAdminFee: undefined,
    lastWinnerPayout: undefined,
    entropyHex: undefined,
    commitmentHash: undefined,
  };
}

function persistBalance(user: User | null) {
  if (!user?.id) return;
  updateLocalBalance(user.id, user.balance);
}

function balanceFromLedger(userId: string, fallback: number): number {
  const a = getAccountById(userId);
  return a ? a.balance : fallback;
}

/** Real-time UI: notify LiveBalance listeners in the same tab */
function emitBalance(balance: number, userId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('equb:balance', {
        detail: { balance, userId, at: Date.now() },
      }),
    );
  } catch {
    /* ignore */
  }
}

export const useEqubStore = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      rooms: [],
      history: [],
      adminEarningsTotal: 0,
      adminFeeLog: [],

      setSessionUser: (user) => {
        const bal = balanceFromLedger(user.id, user.balance);
        const next = { ...user, balance: bal };
        set({ user: next });
        emitBalance(bal, user.id);
      },

      loginDemo: (name) => {
        const n = (name || 'ተጫዋች').slice(0, 24);
        const u = {
          id: `u_${Date.now().toString(36)}`,
          name: n,
          phone: undefined as string | undefined,
          email: `${n.toLowerCase().replace(/\s/g, '')}@demo.equb`,
          balance: 5000,
          referralCode:
            n.slice(0, 4).toUpperCase() +
            Math.random().toString(36).slice(2, 6).toUpperCase(),
          role: 'player' as const,
        };
        set({ user: u });
        emitBalance(u.balance, u.id);
      },

      logout: () => set({ user: null }),

      ensureRooms: () => {
        const current = get().rooms;
        if (current.length === 0) {
          set({ rooms: catalogToRooms() });
          return;
        }
        const fixed = current.map((r) =>
          r.status === 'drawing' ? { ...r, status: 'open' as const } : r,
        );
        if (fixed.some((r, i) => r.status !== current[i]?.status)) {
          set({ rooms: fixed });
        }
      },

      joinRoom: (roomId, pick) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, message: msg('signInFirst') };
        if (user.banned) return { ok: false, message: 'Account banned' };

        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: msg('roomNotFound') };

        if (room.status === 'completed') {
          const reset = freshRound(room);
          set({ rooms: rooms.map((r) => (r.id === roomId ? reset : r)) });
          return get().joinRoom(roomId, pick);
        }

        if (room.status === 'drawing') {
          set({
            rooms: rooms.map((r) =>
              r.id === roomId ? { ...r, status: 'open' as const } : r,
            ),
          });
        }

        const live = get().rooms.find((r) => r.id === roomId)!;

        if (live.status !== 'open') {
          return { ok: false, message: msg('cannotFill') };
        }

        if (isFull(live)) {
          return { ok: false, message: msg('alreadyFull') };
        }

        if (live.members.some((m) => m.id === user.id))
          return { ok: false, message: msg('alreadyInRound') };
        if (pick < 1 || pick > live.groupSize)
          return { ok: false, message: msg('pickRange', { size: live.groupSize }) };
        if (takenPicks(live).has(pick)) return { ok: false, message: msg('numberTaken') };

        const fee = live.contribution;
        if (user.balance < fee)
          return {
            ok: false,
            message: msg('needBirr', { fee, balance: user.balance }),
          };

        const debit = tryDebitAccount(user.id, fee);
        if (!debit.ok) return { ok: false, message: debit.message };

        const nextBal =
          debit.balance >= 0
            ? debit.balance
            : Math.round((user.balance - fee) * 100) / 100;

        const member: EqubMember = { id: user.id, name: user.name, pick };
        const nextUser = { ...user, balance: nextBal };
        if (debit.balance < 0) persistBalance(nextUser);
        set({
          user: nextUser,
          rooms: get().rooms.map((r) =>
            r.id === roomId
              ? { ...r, members: [...r.members, member], status: 'open' as const }
              : r,
          ),
        });
        emitBalance(nextUser.balance, nextUser.id);
        return { ok: true, message: msg('joined', { pick }) };
      },

      fillSeats: (roomId) => {
        const rooms = get().rooms;
        const room = rooms.find((r) => r.id === roomId);
        if (!room || room.status !== 'open') return { ok: false, message: msg('cannotFill') };
        const taken = takenPicks(room);
        const need = room.groupSize - room.members.length;
        if (need <= 0) return { ok: false, message: msg('alreadyFull') };
        const free = numberPool(room.groupSize).filter((n) => !taken.has(n));
        for (let i = free.length - 1; i > 0; i--) {
          const j = secureRandomInt(i + 1);
          [free[i], free[j]] = [free[j]!, free[i]!];
        }
        const bots: EqubMember[] = free.slice(0, need).map((pick, i) => ({
          id: `bot_${roomId}_${i}_${Date.now()}`,
          name: BOT_NAMES[i % BOT_NAMES.length]! + i,
          pick,
          isBot: true,
        }));
        set({
          rooms: rooms.map((r) =>
            r.id === roomId ? { ...r, members: [...r.members, ...bots] } : r,
          ),
        });
        return { ok: true, message: msg('filledBots', { n: bots.length }) };
      },

      runDraw: async (roomId) => {
        const { user, rooms, history, adminEarningsTotal, adminFeeLog } = get();
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: msg('roomNotFound') };
        if (!isFull(room)) return { ok: false, message: msg('roomNotFull') };
        if (room.status === 'completed') return { ok: false, message: msg('alreadyDrawn') };

        set({
          rooms: rooms.map((r) => (r.id === roomId ? { ...r, status: 'drawing' } : r)),
        });

        try {
          const proof = await cryptographicDraw(room.groupSize);
          let winner = room.members.find((m) => m.pick === proof.winningNumber);
          if (!winner && room.members.length > 0) {
            winner = room.members[secureRandomInt(room.members.length)];
          }
          if (!winner) {
            set({
              rooms: get().rooms.map((r) =>
                r.id === roomId ? { ...r, status: 'open' as const } : r,
              ),
            });
            return { ok: false, message: msg('drawError') };
          }

          const winningNumber = winner.pick;
          const { grossPot, adminFee, winnerPayout } = splitPot(room.prizePool);

          const wasYou = !!(user && winner.id === user.id);
          let nextUser = user;
          if (wasYou && user) {
            const credited = creditAccount(user.id, winnerPayout);
            const nextBal =
              credited != null
                ? credited
                : Math.round((user.balance + winnerPayout) * 100) / 100;
            nextUser = { ...user, balance: nextBal };
            if (credited == null) persistBalance(nextUser);
          }
          const bal = nextUser?.balance ?? 0;
          const canAgain = bal >= room.contribution;
          const again = canAgain ? msg('playAgainHint') : msg('needMoreHint');

          const feeEvent: AdminFeeEvent = {
            roomId,
            grossPot,
            adminFee,
            winnerPayout,
            winnerName: winner.name,
            at: Date.now(),
          };

          if (nextUser) emitBalance(nextUser.balance, nextUser.id);
          set({
            user: nextUser,
            adminEarningsTotal: Math.round((adminEarningsTotal + adminFee) * 100) / 100,
            adminFeeLog: [feeEvent, ...adminFeeLog].slice(0, 100),
            rooms: get().rooms.map((r) =>
              r.id === roomId
                ? {
                    ...r,
                    status: 'completed',
                    winningNumber,
                    winnerId: winner!.id,
                    lastAdminFee: adminFee,
                    lastWinnerPayout: winnerPayout,
                    entropyHex: proof.entropyHex,
                    commitmentHash: proof.commitmentHash,
                  }
                : r,
            ),
            history: [
              {
                roomId,
                winningNumber,
                winnerName: winner.name,
                amount: grossPot,
                winnerPayout,
                adminFee,
                wasYou,
                at: Date.now(),
                entropyHex: proof.entropyHex,
                commitmentHash: proof.commitmentHash,
              },
              ...history,
            ].slice(0, 50),
          });

          return {
            ok: true,
            message: wasYou
              ? msg('youWon', {
                  pot: winnerPayout,
                  num: winningNumber,
                  again,
                  fee: adminFee,
                  pct: Math.round(ADMIN_FEE_RATE * 100),
                })
              : msg('otherWon', {
                  num: winningNumber,
                  name: winner.name,
                  again,
                  pot: winnerPayout,
                  fee: adminFee,
                }),
          };
        } catch {
          set({
            rooms: get().rooms.map((r) =>
              r.id === roomId ? { ...r, status: 'open' as const } : r,
            ),
          });
          return { ok: false, message: msg('drawError') };
        }
      },

      reopenRoom: (roomId) => {
        const { rooms } = get();
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: msg('roomNotFound') };
        set({
          rooms: rooms.map((r) => (r.id === roomId ? freshRound(r) : r)),
        });
        return { ok: true, message: msg('newRoundOpen') };
      },

      adjustBalance: (delta) => {
        const { user } = get();
        if (!user) return { ok: false, message: msg('signInFirst') };
        if (!Number.isFinite(delta) || delta === 0) {
          return { ok: false, message: 'Invalid amount' };
        }
        if (delta < 0) {
          const need = Math.abs(delta);
          if (user.balance < need) {
            return {
              ok: false,
              message: msg('needBirr', { fee: need, balance: user.balance }),
            };
          }
          const debit = tryDebitAccount(user.id, need);
          if (!debit.ok) return { ok: false, message: debit.message };
          const nextBal =
            debit.balance >= 0
              ? debit.balance
              : Math.round((user.balance - need) * 100) / 100;
          const nextUser = { ...user, balance: nextBal };
          set({ user: nextUser });
          if (debit.balance < 0) persistBalance(nextUser);
          emitBalance(nextBal, user.id);
          return { ok: true, message: 'ok', balance: nextBal };
        }
        const credited = creditAccount(user.id, delta);
        const nextBal =
          credited != null
            ? credited
            : Math.round((user.balance + delta) * 100) / 100;
        const nextUser = { ...user, balance: nextBal };
        set({ user: nextUser });
        if (credited == null) persistBalance(nextUser);
        emitBalance(nextBal, user.id);
        return { ok: true, message: 'ok', balance: nextBal };
      },

      refreshBalance: () => {
        const { user } = get();
        if (!user) return;
        const bal = balanceFromLedger(user.id, user.balance);
        if (bal !== user.balance) {
          set({ user: { ...user, balance: bal } });
          emitBalance(bal, user.id);
        }
      },

      claimReferral: (code) => {
        const { user } = get();
        if (!user) return { ok: false, message: msg('signInFirst') };
        if (user.referredBy) return { ok: false, message: msg('alreadyClaimed') };
        if (!code.trim()) return { ok: false, message: msg('invalidCode') };
        const nextUser = {
          ...user,
          referredBy: code.trim().toUpperCase(),
          balance: user.balance + 100,
        };
        persistBalance(nextUser);
        set({ user: nextUser });
        emitBalance(nextUser.balance, nextUser.id);
        return { ok: true, message: msg('referralOk') };
      },
    }),
    {
      name: 'fast-equb-v6',
      version: 6,
      migrate: (persisted: unknown) => {
        const p = (persisted || {}) as Record<string, unknown>;
        return {
          ...p,
          adminEarningsTotal: Number(p.adminEarningsTotal) || 0,
          adminFeeLog: Array.isArray(p.adminFeeLog) ? p.adminFeeLog : [],
          history: Array.isArray(p.history) ? p.history : [],
          rooms: Array.isArray(p.rooms) ? p.rooms : [],
        };
      },
      onRehydrateStorage: () => (state) => {
        if (!state?.user?.id) return;
        try {
          const a = getAccountById(state.user.id);
          if (a && a.balance !== state.user.balance) {
            state.user = { ...state.user, balance: a.balance };
          }
        } catch {
          /* ignore */
        }
      },
    },
  ),
);
