'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buildRoomCatalog,
  type LiveRoom,
  type EqubMember,
  isFull,
  takenPicks,
  seatsTaken,
  memberPicks,
  maxPicksForGroup,
  validatePicks,
  splitPot,
  ADMIN_FEE_RATE,
} from './equb-math';
import { cryptographicDraw, secureRandomInt } from './crypto-rng';
import { msg } from './i18n/messages';
import {
  updateLocalBalance,
  getAccountById,
  tryDebitAccount,
} from './auth-local';
import { apiAdjustBalance, apiRefreshUser, isDbUserId } from './auth-api';
import {
  loadSessionUser,
  loadSessionUserId,
  saveSessionUser,
  clearSession,
} from './session';

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
  hydrated: boolean;
  setSessionUser: (user: User) => void;
  /** @deprecated Demo login removed — real register/login only */
  loginDemo: (name?: string) => void;
  logout: () => void;
  ensureRooms: () => void;
  joinRoom: (
    roomId: string,
    pick: number | number[],
  ) => { ok: boolean; message: string };
  /** Bots disabled — real players only */
  fillSeats: (roomId: string) => { ok: boolean; message: string };
  runDraw: (roomId: string) => Promise<{ ok: boolean; message: string }>;
  reopenRoom: (roomId: string) => { ok: boolean; message: string };
  claimReferral: (code: string) => { ok: boolean; message: string };
  adjustBalance: (delta: number) => { ok: boolean; message: string; balance?: number };
  refreshBalance: () => void;
};

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
    winnerName: null,
  }));
}

function freshRound(room: LiveRoom): LiveRoom {
  return {
    ...room,
    members: [],
    status: 'open',
    winningNumber: null,
    winnerId: null,
    winnerName: null,
    lastAdminFee: undefined,
    lastWinnerPayout: undefined,
    entropyHex: undefined,
    commitmentHash: undefined,
  };
}

function isFakeUserId(id: string): boolean {
  return (
    id.startsWith('demo_') ||
    id.startsWith('bot_') ||
    id.startsWith('guest_') ||
    id === 'ssr'
  );
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

function restoreUserFromStorage(): User | null {
  const snap = loadSessionUser();
  if (snap?.id) {
    if (isFakeUserId(String(snap.id))) {
      clearSession();
      return null;
    }
    if (!isDbUserId(snap.id)) {
      const a = getAccountById(snap.id);
      if (a) {
        return {
          id: a.id,
          name: a.fullName,
          phone: a.phone,
          email: `${a.phone.replace('+', '')}@phone.equb`,
          balance: a.balance,
          referralCode: a.referralCode,
          role: a.role || 'player',
          banned: a.banned,
        };
      }
    }
    return snap as User;
  }
  const id = loadSessionUserId();
  if (!id || isFakeUserId(id)) return null;
  if (!isDbUserId(id)) {
    const a = getAccountById(id);
    if (a) {
      return {
        id: a.id,
        name: a.fullName,
        phone: a.phone,
        email: `${a.phone.replace('+', '')}@phone.equb`,
        balance: a.balance,
        referralCode: a.referralCode,
        role: a.role || 'player',
        banned: a.banned,
      };
    }
  }
  return null;
}

export const useEqubStore = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      rooms: [],
      history: [],
      adminEarningsTotal: 0,
      adminFeeLog: [],
      hydrated: false,

      setSessionUser: (user) => {
        if (isFakeUserId(String(user.id))) {
          clearSession();
          set({ user: null });
          return;
        }
        const bal = isDbUserId(user.id)
          ? user.balance
          : balanceFromLedger(user.id, user.balance);
        const next: User = { ...user, balance: bal };
        set({ user: next });
        saveSessionUser(next);
        emitBalance(bal, user.id);
        if (isDbUserId(user.id)) {
          void apiRefreshUser(user.id).then((u) => {
            if (!u) return;
            const cur = get().user;
            if (cur?.id !== u.id) return;
            const refreshed: User = {
              ...cur,
              name: u.fullName,
              phone: u.phone,
              balance: u.balance,
              role: u.role as 'player' | 'admin',
              referralCode: u.referralCode,
              banned: u.banned,
            };
            set({ user: refreshed });
            saveSessionUser(refreshed);
            emitBalance(u.balance, u.id);
          });
        }
      },

      loginDemo: () => {
        // Disabled — real register / login only
        return;
      },

      logout: () => {
        clearSession();
        set({ user: null });
      },

      ensureRooms: () => {
        const current = get().rooms;
        if (current.length === 0) {
          set({ rooms: catalogToRooms() });
          return;
        }
        // Strip any leftover bot members from local rooms
        const cleaned = current.map((r) => ({
          ...r,
          members: r.members.filter((m) => !m.isBot && !String(m.id).startsWith('bot_')),
          status: r.status === 'drawing' ? ('open' as const) : r.status,
        }));
        set({ rooms: cleaned });
      },

      joinRoom: (roomId, pickOrPicks) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, message: msg('signInFirst') };
        if (user.banned) return { ok: false, message: 'Account banned' };
        if (isFakeUserId(user.id)) {
          return { ok: false, message: 'Demo accounts disabled — register a real account' };
        }

        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: msg('roomNotFound') };

        if (room.status === 'completed') {
          const reset = freshRound(room);
          set({ rooms: rooms.map((r) => (r.id === roomId ? reset : r)) });
          return get().joinRoom(roomId, pickOrPicks);
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

        const raw = Array.isArray(pickOrPicks) ? pickOrPicks : [pickOrPicks];
        const validated = validatePicks(live.groupSize, raw, takenPicks(live));
        if (!validated.ok) return { ok: false, message: validated.message };
        const picks = validated.picks;

        if (seatsTaken(live) + picks.length > live.groupSize) {
          return { ok: false, message: msg('alreadyFull') };
        }

        const fee =
          Math.round(live.contribution * picks.length * 100) / 100;
        if (user.balance < fee)
          return {
            ok: false,
            message: msg('needBirr', { fee, balance: user.balance }),
          };

        const member: EqubMember = {
          id: user.id,
          name: user.name,
          pick: picks[0]!,
          picks,
        };
        const debit = get().adjustBalance(-fee);
        if (!debit.ok) return { ok: false, message: debit.message };

        set({
          rooms: get().rooms.map((r) =>
            r.id === roomId
              ? { ...r, members: [...r.members, member], status: 'open' as const }
              : r,
          ),
        });
        return {
          ok: true,
          message: `Joined · #${picks.map((p) => String(p).padStart(2, '0')).join(', #')} · max ${maxPicksForGroup(live.groupSize)}`,
        };
      },

      fillSeats: () => ({
        ok: false,
        message: 'Bots disabled — only real players can join',
      }),

      runDraw: async (roomId) => {
        const { user, rooms, history, adminEarningsTotal, adminFeeLog } = get();
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: msg('roomNotFound') };

        // Real players only — no bots in the draw
        const humans = room.members.filter(
          (m) => !m.isBot && !String(m.id).startsWith('bot_'),
        );
        if (humans.length === 0) {
          return { ok: false, message: 'Need at least one real player' };
        }
        if (!isFull({ ...room, members: humans }) && seatsTaken({ ...room, members: humans }) < room.groupSize) {
          // Allow draw only when full of real seats, or when room is full
        }
        if (!isFull(room)) return { ok: false, message: msg('roomNotFull') };
        if (room.status === 'completed')
          return { ok: false, message: msg('alreadyDrawn') };

        set({
          rooms: rooms.map((r) =>
            r.id === roomId ? { ...r, status: 'drawing' } : r,
          ),
        });

        try {
          const proof = await cryptographicDraw(room.groupSize);
          const allPicks = humans.flatMap((m) => memberPicks(m));
          if (allPicks.length === 0) {
            set({
              rooms: get().rooms.map((r) =>
                r.id === roomId ? { ...r, status: 'open' as const } : r,
              ),
            });
            return { ok: false, message: 'No real player picks' };
          }
          let winningNumber = proof.winningNumber;
          if (!allPicks.includes(winningNumber)) {
            winningNumber = allPicks[secureRandomInt(allPicks.length)]!;
          }
          let winner = humans.find((m) =>
            memberPicks(m).includes(winningNumber),
          );
          if (!winner) {
            winner = humans[secureRandomInt(humans.length)];
            winningNumber = winner!.pick;
          }

          const { grossPot, adminFee, winnerPayout } = splitPot(room.prizePool);
          const wasYou = !!(user && winner.id === user.id);
          if (wasYou && user) {
            get().adjustBalance(winnerPayout);
          }
          const nextUser = get().user;
          if (nextUser) {
            saveSessionUser(nextUser);
            emitBalance(nextUser.balance, nextUser.id);
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

          set({
            user: nextUser,
            adminEarningsTotal:
              Math.round((adminEarningsTotal + adminFee) * 100) / 100,
            adminFeeLog: [feeEvent, ...adminFeeLog].slice(0, 100),
            rooms: get().rooms.map((r) =>
              r.id === roomId
                ? {
                    ...r,
                    status: 'completed' as const,
                    members: humans,
                    winningNumber,
                    winnerId: winner!.id,
                    winnerName: winner!.name,
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
          const next = { ...user, balance: nextBal };
          set({ user: next });
          saveSessionUser(next);
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
                saveSessionUser({ ...cur, balance: user.balance });
                emitBalance(user.balance, user.id);
              }
              return;
            }
            const cur = get().user;
            if (cur?.id === r.user.id) {
              const nextU = { ...cur, balance: r.user.balance };
              set({ user: nextU });
              saveSessionUser(nextU);
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
          const next = { ...user, balance: nextBal };
          set({ user: next });
          saveSessionUser(next);
          emitBalance(nextBal, user.id);
          return { ok: true, message: 'ok', balance: nextBal };
        }
        const nextBal = Math.round((user.balance + delta) * 100) / 100;
        if (!isDbUserId(user.id)) {
          updateLocalBalance(user.id, nextBal);
        }
        const next = { ...user, balance: nextBal };
        set({ user: next });
        saveSessionUser(next);
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
            const next: User = {
              ...cur,
              balance: u.balance,
              name: u.fullName,
              role: u.role as 'player' | 'admin',
            };
            set({ user: next });
            saveSessionUser(next);
            emitBalance(u.balance, u.id);
          });
          return;
        }
        const bal = balanceFromLedger(user.id, user.balance);
        if (bal !== user.balance) {
          const next = { ...user, balance: bal };
          set({ user: next });
          saveSessionUser(next);
          emitBalance(bal, user.id);
        }
      },

      claimReferral: (code) => {
        const { user } = get();
        if (!user) return { ok: false, message: msg('signInFirst') };
        if (user.referredBy) return { ok: false, message: msg('alreadyClaimed') };
        if (!code.trim()) return { ok: false, message: msg('invalidCode') };
        // No free bonus in real mode — mark code only
        const nextUser = {
          ...user,
          referredBy: code.trim().toUpperCase(),
        };
        set({ user: nextUser });
        saveSessionUser(nextUser);
        return { ok: true, message: msg('referralOk') };
      },
    }),
    {
      name: 'fast-equb-v8',
      version: 9,
      partialize: (s) => ({
        user:
          s.user && !isFakeUserId(String(s.user.id)) ? s.user : null,
        rooms: s.rooms.map((r) => ({
          ...r,
          members: r.members.filter(
            (m) => !m.isBot && !String(m.id).startsWith('bot_'),
          ),
        })),
        history: s.history,
        adminEarningsTotal: s.adminEarningsTotal,
        adminFeeLog: s.adminFeeLog,
      }),
      onRehydrateStorage: () => () => {
        const restored = restoreUserFromStorage();
        if (restored) {
          useEqubStore.setState({ user: restored, hydrated: true });
          if (isDbUserId(restored.id)) {
            void apiRefreshUser(restored.id).then((u) => {
              if (!u) return;
              const next: User = {
                id: u.id,
                name: u.fullName,
                email: `${u.phone}@phone.equb`,
                phone: u.phone,
                balance: u.balance,
                referralCode: u.referralCode,
                role: u.role as 'player' | 'admin',
                banned: u.banned,
              };
              useEqubStore.setState({ user: next });
              saveSessionUser(next);
            });
          }
        } else {
          useEqubStore.setState({ hydrated: true });
        }
      },
    },
  ),
);

if (typeof window !== 'undefined') {
  const early = restoreUserFromStorage();
  if (early && !useEqubStore.getState().user) {
    useEqubStore.setState({ user: early, hydrated: true });
  }
}
