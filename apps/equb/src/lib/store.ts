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
} from './equb-math';
import { cryptographicDraw, secureRandomInt } from './crypto-rng';
import { msg } from './i18n/messages';
import { updateLocalBalance } from './auth-local';

type User = {
  id: string;
  name: string;
  phone?: string;
  email: string;
  balance: number;
  referralCode: string;
  referredBy?: string;
};

type HistoryEvent = {
  roomId: string;
  winningNumber: number;
  winnerName: string;
  amount: number;
  wasYou: boolean;
  at: number;
  entropyHex?: string;
  commitmentHash?: string;
};

type State = {
  user: User | null;
  rooms: LiveRoom[];
  history: HistoryEvent[];
  /** Phone + password accounts */
  setSessionUser: (user: User) => void;
  loginDemo: (name?: string) => void;
  logout: () => void;
  ensureRooms: () => void;
  joinRoom: (roomId: string, pick: number) => { ok: boolean; message: string };
  fillSeats: (roomId: string) => { ok: boolean; message: string };
  runDraw: (roomId: string) => Promise<{ ok: boolean; message: string }>;
  reopenRoom: (roomId: string) => { ok: boolean; message: string };
  claimReferral: (code: string) => { ok: boolean; message: string };
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
  };
}

function persistBalance(user: User | null) {
  if (user?.id) updateLocalBalance(user.id, user.balance);
}

export const useEqubStore = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      rooms: [],
      history: [],

      setSessionUser: (user) => set({ user }),

      loginDemo: (name) => {
        const n = (name || 'ተጫዋች').slice(0, 24);
        set({
          user: {
            id: `u_${Date.now().toString(36)}`,
            name: n,
            phone: undefined,
            email: `${n.toLowerCase().replace(/\s/g, '')}@demo.equb`,
            balance: 5000,
            referralCode:
              n.slice(0, 4).toUpperCase() +
              Math.random().toString(36).slice(2, 6).toUpperCase(),
          },
        });
      },

      logout: () => set({ user: null }),

      ensureRooms: () => {
        if (get().rooms.length === 0) set({ rooms: catalogToRooms() });
      },

      joinRoom: (roomId, pick) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, message: msg('signInFirst') };

        let room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: msg('roomNotFound') };

        if (room.status === 'completed' || room.status === 'drawing' || isFull(room)) {
          room = freshRound(room);
          set({ rooms: rooms.map((r) => (r.id === roomId ? room! : r)) });
          room = get().rooms.find((r) => r.id === roomId)!;
        }

        if (room.members.some((m) => m.id === user.id))
          return { ok: false, message: msg('alreadyInRound') };
        if (pick < 1 || pick > room.groupSize)
          return { ok: false, message: msg('pickRange', { size: room.groupSize }) };
        if (takenPicks(room).has(pick)) return { ok: false, message: msg('numberTaken') };

        const fee = room.contribution;
        if (user.balance < fee)
          return {
            ok: false,
            message: msg('needBirr', { fee, balance: user.balance }),
          };

        const member: EqubMember = { id: user.id, name: user.name, pick };
        const nextUser = {
          ...user,
          balance: Math.round((user.balance - fee) * 100) / 100,
        };
        persistBalance(nextUser);
        set({
          user: nextUser,
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
        const { user, rooms, history } = get();
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: msg('roomNotFound') };
        if (!isFull(room)) return { ok: false, message: msg('roomNotFull') };
        if (room.status === 'completed') return { ok: false, message: msg('alreadyDrawn') };

        set({
          rooms: rooms.map((r) => (r.id === roomId ? { ...r, status: 'drawing' } : r)),
        });

        const proof = await cryptographicDraw(room.groupSize);
        const winner = room.members.find((m) => m.pick === proof.winningNumber);
        if (!winner) return { ok: false, message: msg('drawError') };

        const wasYou = !!(user && winner.id === user.id);
        let nextUser = user;
        if (wasYou && user) {
          nextUser = { ...user, balance: user.balance + room.prizePool };
          persistBalance(nextUser);
        }
        const bal = nextUser?.balance ?? 0;
        const canAgain = bal >= room.contribution;
        const again = canAgain ? msg('playAgainHint') : msg('needMoreHint');

        set({
          user: nextUser,
          rooms: get().rooms.map((r) =>
            r.id === roomId
              ? {
                  ...r,
                  status: 'completed',
                  winningNumber: proof.winningNumber,
                  winnerId: winner.id,
                  entropyHex: proof.entropyHex,
                  commitmentHash: proof.commitmentHash,
                }
              : r,
          ),
          history: [
            {
              roomId,
              winningNumber: proof.winningNumber,
              winnerName: winner.name,
              amount: room.prizePool,
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
            ? msg('youWon', { pot: room.prizePool, num: proof.winningNumber, again })
            : msg('otherWon', {
                num: proof.winningNumber,
                name: winner.name,
                again,
              }),
        };
      },

      reopenRoom: (roomId) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, message: msg('signInFirst') };
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: msg('roomNotFound') };
        if (user.balance < room.contribution) {
          return {
            ok: false,
            message: msg('needForRound', {
              fee: room.contribution,
              balance: user.balance,
            }),
          };
        }
        set({
          rooms: rooms.map((r) => (r.id === roomId ? freshRound(r) : r)),
        });
        return { ok: true, message: msg('newRoundOpen') };
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
        return { ok: true, message: msg('referralOk') };
      },
    }),
    { name: 'fast-equb-v3' },
  ),
);
