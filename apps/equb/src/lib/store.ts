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

type User = {
  id: string;
  name: string;
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
  loginDemo: (name?: string) => void;
  logout: () => void;
  ensureRooms: () => void;
  joinRoom: (roomId: string, pick: number) => { ok: boolean; message: string };
  fillSeats: (roomId: string) => { ok: boolean; message: string };
  runDraw: (roomId: string) => Promise<{ ok: boolean; message: string }>;
  claimReferral: (code: string) => { ok: boolean; message: string };
};

const BOT_NAMES = ['Abebe', 'Tigist', 'Kebede', 'Hanna', 'Yonas', 'Marta', 'Dawit', 'Sara'];

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

export const useEqubStore = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      rooms: [],
      history: [],

      loginDemo: (name) => {
        const n = (name || 'Player').slice(0, 24);
        set({
          user: {
            id: `u_${Date.now().toString(36)}`,
            name: n,
            email: `${n.toLowerCase().replace(/\s/g, '')}@demo.equb`,
            balance: 5000,
            referralCode: n.slice(0, 4).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(),
          },
        });
      },

      logout: () => set({ user: null }),

      ensureRooms: () => {
        if (get().rooms.length === 0) set({ rooms: catalogToRooms() });
      },

      joinRoom: (roomId, pick) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, message: 'Sign in first' };
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: 'Room not found' };
        if (room.status !== 'open') return { ok: false, message: 'Room closed' };
        if (room.members.some((m) => m.id === user.id))
          return { ok: false, message: 'Already joined' };
        if (isFull(room)) return { ok: false, message: 'Room full' };
        if (pick < 1 || pick > room.groupSize)
          return { ok: false, message: `Pick 1–${room.groupSize}` };
        if (takenPicks(room).has(pick)) return { ok: false, message: 'Number taken' };
        if (user.balance < room.contribution)
          return { ok: false, message: 'Insufficient balance' };

        const member: EqubMember = { id: user.id, name: user.name, pick };
        set({
          user: { ...user, balance: user.balance - room.contribution },
          rooms: rooms.map((r) =>
            r.id === roomId ? { ...r, members: [...r.members, member] } : r,
          ),
        });
        return { ok: true, message: `Joined with #${pick}` };
      },

      fillSeats: (roomId) => {
        const rooms = get().rooms;
        const room = rooms.find((r) => r.id === roomId);
        if (!room || room.status !== 'open') return { ok: false, message: 'Cannot fill' };
        const taken = takenPicks(room);
        const need = room.groupSize - room.members.length;
        if (need <= 0) return { ok: false, message: 'Already full' };
        const free = numberPool(room.groupSize).filter((n) => !taken.has(n));
        // CSPRNG shuffle free picks
        for (let i = free.length - 1; i > 0; i--) {
          const j = secureRandomInt(i + 1);
          [free[i], free[j]] = [free[j]!, free[i]!];
        }
        const bots: EqubMember[] = free.slice(0, need).map((pick, i) => ({
          id: `bot_${roomId}_${i}`,
          name: BOT_NAMES[i % BOT_NAMES.length]! + i,
          pick,
          isBot: true,
        }));
        set({
          rooms: rooms.map((r) =>
            r.id === roomId ? { ...r, members: [...r.members, ...bots] } : r,
          ),
        });
        return { ok: true, message: `Filled ${bots.length} seats with bots` };
      },

      runDraw: async (roomId) => {
        const { user, rooms, history } = get();
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: 'Room not found' };
        if (!isFull(room)) return { ok: false, message: 'Room not full' };
        if (room.status === 'completed') return { ok: false, message: 'Already drawn' };

        set({
          rooms: rooms.map((r) => (r.id === roomId ? { ...r, status: 'drawing' } : r)),
        });

        const proof = await cryptographicDraw(room.groupSize);
        const winner = room.members.find((m) => m.pick === proof.winningNumber);
        if (!winner) return { ok: false, message: 'Draw failed' };

        const wasYou = !!(user && winner.id === user.id);
        let nextUser = user;
        if (wasYou && user) {
          nextUser = { ...user, balance: user.balance + room.prizePool };
        }

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
            ? `You won ${room.prizePool} Birr! Number ${proof.winningNumber}`
            : `Winner #${proof.winningNumber} · ${winner.name}`,
        };
      },

      claimReferral: (code) => {
        const { user } = get();
        if (!user) return { ok: false, message: 'Sign in first' };
        if (user.referredBy) return { ok: false, message: 'Already claimed' };
        if (!code.trim()) return { ok: false, message: 'Enter a code' };
        set({
          user: {
            ...user,
            referredBy: code.trim().toUpperCase(),
            balance: user.balance + 100,
          },
        });
        return { ok: true, message: '+100 virtual Birr' };
      },
    }),
    { name: 'fast-equb-v1' },
  ),
);
