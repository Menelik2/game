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
import { cryptographicDraw, secureRandomInt, type DrawProof } from './crypto-rng';

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
  groupSize?: number;
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
  runDraw: (roomId: string) => Promise<{ ok: boolean; message: string; proof?: DrawProof }>;
  claimReferral: (code: string) => { ok: boolean; message: string };
  resetRooms: () => void;
};

function uid() {
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

const BOT_NAMES = [
  'Abebe', 'Tigist', 'Dawit', 'Hanna', 'Yonas', 'Meron', 'Samuel', 'Liya',
  'Kidus', 'Sara', 'Biniyam', 'Rahel', 'Nahom', 'Betty', 'Elias', 'Mekdes',
  'Abel', 'Selam', 'Fikru', 'Hiwot',
];

const STARTER_BALANCE = 5000;

export const useEqubStore = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      rooms: [],
      history: [],

      loginDemo: (name) => {
        const id = uid();
        set({
          user: {
            id,
            name: (name || 'Equb Player').trim() || 'Equb Player',
            email: `player_${id.slice(2)}@fast-equb.demo`,
            balance: STARTER_BALANCE,
            referralCode: id.slice(2, 8).toUpperCase(),
          },
        });
        get().ensureRooms();
      },

      logout: () => set({ user: null }),

      ensureRooms: () => {
        if (get().rooms.length > 0) return;
        const templates = buildRoomCatalog({ maxPrize: 9000 });
        set({
          rooms: templates.map((t) => ({
            ...t,
            members: [],
            status: 'open' as const,
            winningNumber: null,
            winnerId: null,
            createdAt: Date.now(),
          })),
        });
      },

      resetRooms: () => {
        const templates = buildRoomCatalog({ maxPrize: 9000 });
        set({
          rooms: templates.map((t) => ({
            ...t,
            members: [],
            status: 'open' as const,
            winningNumber: null,
            winnerId: null,
            createdAt: Date.now(),
          })),
        });
      },

      joinRoom: (roomId, pick) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, message: 'Please sign in first' };
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: 'Room not found' };
        if (room.status !== 'open') return { ok: false, message: 'Room closed' };
        if (room.members.some((m) => m.id === user.id))
          return { ok: false, message: 'You already joined' };
        if (isFull(room)) return { ok: false, message: 'Room is full' };
        if (!numberPool(room.groupSize).includes(pick))
          return { ok: false, message: `Pick 1 to ${room.groupSize}` };
        if (takenPicks(room).has(pick))
          return { ok: false, message: `Number ${pick} taken` };
        const fee = room.contribution;
        if (user.balance < fee)
          return { ok: false, message: `Need ${fee} Birr (have ${user.balance})` };

        set({
          user: { ...user, balance: Math.round((user.balance - fee) * 100) / 100 },
          rooms: rooms.map((r) =>
            r.id === roomId
              ? {
                  ...r,
                  members: [
                    ...r.members,
                    { id: user.id, name: user.name, pick, isBot: false },
                  ],
                }
              : r,
          ),
        });
        return { ok: true, message: `Joined with #${pick}. Paid ${fee} Birr.` };
      },

      fillSeats: (roomId) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, message: 'Sign in first' };
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: 'Room not found' };
        if (room.status !== 'open') return { ok: false, message: 'Room not open' };
        if (!room.members.some((m) => m.id === user.id))
          return { ok: false, message: 'Join and pick a number first' };
        const need = room.groupSize - room.members.length;
        if (need <= 0) return { ok: false, message: 'Already full' };

        const taken = takenPicks(room);
        const free = numberPool(room.groupSize).filter((n) => !taken.has(n));
        for (let i = free.length - 1; i > 0; i--) {
          const j = secureRandomInt(i + 1);
          [free[i], free[j]] = [free[j], free[i]];
        }
        const bots: EqubMember[] = [];
        for (let i = 0; i < need; i++) {
          bots.push({
            id: `bot_${uid()}`,
            name: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? String(i) : ''),
            pick: free[i],
            isBot: true,
          });
        }
        set({
          rooms: rooms.map((r) =>
            r.id === roomId ? { ...r, members: [...r.members, ...bots] } : r,
          ),
        });
        return { ok: true, message: `Filled ${need} seats. Ready to draw!` };
      },

      runDraw: async (roomId) => {
        const { user, rooms, history } = get();
        if (!user) return { ok: false, message: 'Sign in first' };
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: 'Room not found' };
        if (room.status === 'completed') return { ok: false, message: 'Already drawn' };
        if (!isFull(room)) return { ok: false, message: 'Room must be full' };
        if (!room.members.every((m) => m.pick != null))
          return { ok: false, message: 'Everyone needs a number' };
        if (!room.members.some((m) => m.id === user.id))
          return { ok: false, message: 'Members only' };

        let proof: DrawProof;
        try {
          proof = await cryptographicDraw(room.groupSize);
        } catch (e: any) {
          return { ok: false, message: e?.message || 'Crypto RNG failed' };
        }

        const winningNumber = proof.winningNumber;
        const winner = room.members.find((m) => m.pick === winningNumber);
        if (!winner) return { ok: false, message: 'Draw error' };

        const wasYou = winner.id === user.id;
        let newBalance = user.balance;
        if (wasYou) {
          newBalance = Math.round((user.balance + room.prizePool) * 100) / 100;
        }

        set({
          user: { ...user, balance: newBalance },
          history: [
            {
              roomId,
              winningNumber,
              winnerName: winner.name,
              amount: room.prizePool,
              wasYou,
              at: proof.drawnAt,
              groupSize: room.groupSize,
              entropyHex: proof.entropyHex,
              commitmentHash: proof.commitmentHash,
            },
            ...history,
          ].slice(0, 50),
          rooms: rooms.map((r) =>
            r.id === roomId
              ? {
                  ...r,
                  status: 'completed' as const,
                  winningNumber,
                  winnerId: winner.id,
                }
              : r,
          ),
        });

        return {
          ok: true,
          proof,
          message: wasYou
            ? `Winning number ${winningNumber} — YOU win ${room.prizePool.toLocaleString()} Birr!`
            : `Winning number ${winningNumber} — ${winner.name} wins ${room.prizePool.toLocaleString()} Birr.`,
        };
      },

      claimReferral: (code) => {
        const { user } = get();
        if (!user) return { ok: false, message: 'Sign in first' };
        if (user.referredBy) return { ok: false, message: 'Already used' };
        if (!code || code.length < 4) return { ok: false, message: 'Invalid' };
        if (code.toUpperCase() === user.referralCode)
          return { ok: false, message: 'Own code' };
        set({
          user: {
            ...user,
            referredBy: code.toUpperCase(),
            balance: user.balance + 100,
          },
        });
        return { ok: true, message: '+100 virtual Birr!' };
      },
    }),
    { name: 'fast-equb-draw-v1' },
  ),
);
