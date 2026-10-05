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
import { apiAdjustBalance, apiRefreshUser, isDbUserId } from './auth-api';
import { loadSessionUserId, saveSessionUserId } from './session';

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
  if (!user?.id || isDbUserId(user.id)) return;
  updateLocalBalance(user.id, user.balance);
}

function balanceFromLedger(userId: string, fallback: number): number {
  if (isDbUserId(userId)) return fallback;
  const a = getAccountById(userId);
  return a ? a.balance : fallback;
}

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
        const bal = isDbUserId(user.id)
          ? user.balance
          : balanceFromLedger(user.id, user.balance);
        const next = { ...user, balance: bal };
        set({ user: next });
        saveSessionUserId(user.id);
        emitBalance(bal, user.id);
        if (isDbUserId(user.id)) {
          void apiRefreshUser(user.id).then((u) => {
            if (!u) return;
            const cur = get().user;
            if (cur?.id !== u.id) return;
            set({
              user: {
                ...cur,
                name: u.fullName,
                phone: u.phone,
                balance: u.balance,
                role: u.role as any,
                referralCode: u.referralCode,
              },
            });
            emitBalance(u.balance, u.id);
          });
        }
      },

      loginDemo: (name) => {
        const n = (name || 'ተጫዋች').slice(0, 24);
        const u = {
          id: `demo_${Date.now().toString(36)}`,
          name: n,
          phone: undefined as string | undefined,
          email: `${n.toLowerCase().replace(/\s/g, '')}@demo.equb`,
          balance: 100,
          referralCode:
            n.slice(0, 4).toUpperCase() +
            Math.random().toString(36).slice(2, 6).toUpperCase(),
          role: 'player' as const,
        };
        set({ user: u });
        emitBalance(u.balance, u.id);
      },

      logout: () => {
        saveSessionUserId(null);
        set({ user: null });
      },

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
        if (live.status !== 'open') return { ok: false, message: msg('cannotFill') };
        if (isFull(live)) return { ok: false, message: msg('alreadyFull') };
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

        const member: EqubMember = { id: user.id, name: user.name, pick };
        const debit = get().adjustBalance(-fee);
        if (!debit.ok) return { ok: false, message: debit.message };

        set({
          rooms: get().rooms.map((r) =>
            r.id === roomId
              ? { ...r, members: [...r.members, member], status: 'open' as const }
              : r,
          ),
        });
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
          if (wasYou && user) {
            get().adjustBalance(winnerPayout);
          }
          const nextUser = get().user;
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
        set({ rooms: rooms.map((r) => (r.id === roomId ? freshRound(r) : r)) });
        return { ok: true, message: msg('newRoundOpen') };
      },

      adjustBalance: (delta) => {
        const { user } = get();
        if (!user) return { ok: false, message: msg('signInFirst') };
        if (!Number.isFinite(delta) || delta === 0) {
          return { ok: false, message: 'Invalid amount' };
        }
        if (delta < 0 && user.balance < Math.abs(delta)) {
          return {
            ok: false,
            message: msg('needBirr', {
              fee: Math.abs(delta),
              balance: user.balance,
            }),
          };
        }

        if (isDbUserId(user.id)) {
          const nextBal = Math.round((user.balance + delta) * 100) / 100;
          if (nextBal < 0) {
            return {
              ok: false,
              message: msg('needBirr', {
                fee: Math.abs(delta),
                balance: user.balance,
              }),
            };
          }
          set({ user: { ...user, balance: nextBal } });
          emitBalance(nextBal, user.id);
          void apiAdjustBalance(
            user.id,
            delta,
            delta < 0 ? 'join_fee' : 'prize_win',
          ).then((r) => {
            if (!r.ok) {
              const cur = get().user;
              if (cur?.id === user.id) {
                set({ user: { ...cur, balance: user.balance } });
                emitBalance(user.balance, user.id);
              }
              return;
            }
            const cur = get().user;
            if (cur?.id === r.user.id) {
              set({ user: { ...cur, balance: r.user.balance } });
              emitBalance(r.user.balance, r.user.id);
            }
          });
          return { ok: true, message: 'ok', balance: nextBal };
        }

        if (delta < 0) {
          const need = Math.abs(delta);
          const debit = tryDebitAccount(user.id, need);
          if (!debit.ok) return { ok: false, message: debit.message };
          const nextBal =
            debit.balance >= 0
              ? debit.balance
              : Math.round((user.balance - need) * 100) / 100;
          set({ user: { ...user, balance: nextBal } });
          emitBalance(nextBal, user.id);
          return { ok: true, message: 'ok', balance: nextBal };
        }
        const nextBal = Math.round((user.balance + delta) * 100) / 100;
        set({ user: { ...user, balance: nextBal } });
        emitBalance(nextBal, user.id);
        return { ok: true, message: 'ok', balance: nextBal };
      },

      refreshBalance: () => {
        const { user } = get();
        if (!user) return;
        if (isDbUserId(user.id)) {
          void apiRefreshUser(user.id).then((u) => {
            if (!u) return;
            const cur = get().user;
            if (!cur || cur.id !== u.id) return;
            if (cur.balance !== u.balance) {
              set({
                user: {
                  ...cur,
                  balance: u.balance,
                  name: u.fullName,
                  role: u.role as any,
                },
              });
              emitBalance(u.balance, u.id);
            }
          });
          return;
        }
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
        get().adjustBalance(100);
        const nextUser = {
          ...get().user!,
          referredBy: code.trim().toUpperCase(),
        };
        set({ user: nextUser });
        return { ok: true, message: msg('referralOk') };
      },
    }),
    {
      name: 'fast-equb-v7',
      version: 7,
      partialize: (s) => ({
        rooms: s.rooms,
        history: s.history,
        adminEarningsTotal: s.adminEarningsTotal,
        adminFeeLog: s.adminFeeLog,
      }),
      onRehydrateStorage: () => () => {
        const id = loadSessionUserId();
        if (!id || !isDbUserId(id)) return;
        void apiRefreshUser(id).then((u) => {
          if (!u) {
            saveSessionUserId(null);
            return;
          }
          useEqubStore.setState({
            user: {
              id: u.id,
              name: u.fullName,
              email: `${u.phone}@phone.equb`,
              phone: u.phone,
              balance: u.balance,
              referralCode: u.referralCode,
              role: u.role as 'player' | 'admin',
              banned: u.banned,
            },
          });
        });
      },
    },
  ),
);
