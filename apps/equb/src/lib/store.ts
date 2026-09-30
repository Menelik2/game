'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buildRoomCatalog,
  type LiveRoom,
  type EqubMember,
  isFull,
} from './equb-math';

type User = {
  id: string;
  name: string;
  email: string;
  balance: number;
  referralCode: string;
  referredBy?: string;
};

type PayoutEvent = {
  roomId: string;
  recipientName: string;
  amount: number;
  at: number;
  wasYou: boolean;
};

type State = {
  user: User | null;
  rooms: LiveRoom[];
  history: PayoutEvent[];
  loginDemo: (name?: string) => void;
  logout: () => void;
  ensureRooms: () => void;
  joinRoom: (roomId: string) => { ok: boolean; message: string };
  fillSeats: (roomId: string) => { ok: boolean; message: string };
  advanceRound: (roomId: string) => { ok: boolean; message: string };
  finishCycle: (roomId: string) => { ok: boolean; message: string };
  claimReferral: (code: string) => { ok: boolean; message: string };
  resetRooms: () => void;
};

function uid() {
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

function shufflePositions(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const BOT_NAMES = [
  'Abebe', 'Tigist', 'Dawit', 'Hanna', 'Yonas', 'Meron', 'Samuel', 'Liya',
  'Kidus', 'Sara', 'Biniyam', 'Rahel', 'Nahom', 'Betty', 'Elias', 'Mekdes',
  'Abel', 'Selam', 'Fikru', 'Hiwot',
];

function lockRoom(members: EqubMember[]): EqubMember[] {
  const positions = shufflePositions(members.length);
  const next = members.map((m, i) => ({ ...m, position: positions[i] }));
  next.sort((a, b) => a.position - b.position);
  return next;
}

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
            currentRound: 1,
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
            currentRound: 1,
            createdAt: Date.now(),
          })),
        });
      },

      joinRoom: (roomId) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, message: 'Please sign in first' };
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: 'Room not found' };
        if (room.status === 'completed') return { ok: false, message: 'Room completed' };
        if (room.status === 'active') return { ok: false, message: 'Room already started' };
        if (room.members.some((m) => m.id === user.id))
          return { ok: false, message: 'You are already in this room' };
        if (isFull(room)) return { ok: false, message: 'Room is full' };

        const fee = room.contribution;
        if (user.balance < fee)
          return { ok: false, message: `Need ${fee} virtual Birr (you have ${user.balance})` };

        const member: EqubMember = {
          id: user.id,
          name: user.name,
          position: room.members.length + 1,
          hasReceived: false,
        };
        const newMembers = [...room.members, member];
        let status: LiveRoom['status'] = 'open';
        let currentRound = room.currentRound;
        let finalMembers = newMembers;

        if (newMembers.length >= room.groupSize) {
          finalMembers = lockRoom(newMembers);
          status = 'active';
          currentRound = 1;
        }

        set({
          user: { ...user, balance: Math.round((user.balance - fee) * 100) / 100 },
          rooms: rooms.map((r) =>
            r.id === roomId
              ? { ...r, members: finalMembers, status, currentRound }
              : r,
          ),
        });

        const me = finalMembers.find((m) => m.id === user.id);
        return {
          ok: true,
          message:
            status === 'active'
              ? `Room full! You are #${me?.position}. Use Next payout.`
              : `Joined · paid ${fee} Birr · ${room.groupSize - finalMembers.length} seats left.`,
        };
      },

      fillSeats: (roomId) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, message: 'Sign in first' };
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: 'Room not found' };
        if (room.status !== 'open') return { ok: false, message: 'Room not open' };
        if (!room.members.some((m) => m.id === user.id))
          return { ok: false, message: 'Join the room first' };

        const need = room.groupSize - room.members.length;
        if (need <= 0) return { ok: false, message: 'Already full' };

        const usedNames = new Set(room.members.map((m) => m.name));
        const bots: EqubMember[] = [];
        for (const name of BOT_NAMES) {
          if (bots.length >= need) break;
          if (usedNames.has(name)) continue;
          bots.push({
            id: `bot_${uid()}`,
            name,
            position: room.members.length + bots.length + 1,
            hasReceived: false,
          });
        }
        while (bots.length < need) {
          bots.push({
            id: `bot_${uid()}`,
            name: `Player ${room.members.length + bots.length + 1}`,
            position: room.members.length + bots.length + 1,
            hasReceived: false,
          });
        }

        const finalMembers = lockRoom([...room.members, ...bots]);
        set({
          rooms: rooms.map((r) =>
            r.id === roomId
              ? { ...r, members: finalMembers, status: 'active' as const, currentRound: 1 }
              : r,
          ),
        });
        const me = finalMembers.find((m) => m.id === user.id);
        return {
          ok: true,
          message: `Filled ${need} seats. You are #${me?.position} of ${room.groupSize}.`,
        };
      },

      advanceRound: (roomId) => {
        const { user, rooms, history } = get();
        if (!user) return { ok: false, message: 'Sign in first' };
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: 'Room not found' };
        if (room.status !== 'active') return { ok: false, message: 'Room is not active yet' };

        const sorted = [...room.members].sort((a, b) => a.position - b.position);
        const recipient = sorted.find((m) => !m.hasReceived);
        if (!recipient) {
          set({
            rooms: rooms.map((r) =>
              r.id === roomId ? { ...r, status: 'completed' as const } : r,
            ),
          });
          return { ok: true, message: 'Cycle complete — everyone received once.' };
        }

        const updatedMembers = room.members.map((m) =>
          m.id === recipient.id ? { ...m, hasReceived: true } : m,
        );
        const allDone = updatedMembers.every((m) => m.hasReceived);
        const wasYou = recipient.id === user.id;
        let newBalance = user.balance;
        if (wasYou) {
          newBalance = Math.round((user.balance + room.prizePool) * 100) / 100;
        }

        set({
          user: { ...user, balance: newBalance },
          history: [
            {
              roomId,
              recipientName: recipient.name,
              amount: room.prizePool,
              at: Date.now(),
              wasYou,
            },
            ...history,
          ].slice(0, 50),
          rooms: rooms.map((r) =>
            r.id === roomId
              ? {
                  ...r,
                  members: updatedMembers,
                  currentRound: r.currentRound + 1,
                  status: allDone ? ('completed' as const) : ('active' as const),
                }
              : r,
          ),
        });

        return {
          ok: true,
          message: wasYou
            ? `You received ${room.prizePool.toLocaleString()} Birr!`
            : `${recipient.name} received ${room.prizePool.toLocaleString()} Birr.`,
        };
      },

      finishCycle: (roomId) => {
        let last = { ok: true, message: '' };
        for (let i = 0; i < 120; i++) {
          const room = get().rooms.find((r) => r.id === roomId);
          if (!room || room.status !== 'active') break;
          last = get().advanceRound(roomId);
          if (!last.ok) break;
        }
        return { ok: true, message: last.message || 'Cycle finished.' };
      },

      claimReferral: (code) => {
        const { user } = get();
        if (!user) return { ok: false, message: 'Sign in first' };
        if (user.referredBy) return { ok: false, message: 'Referral already applied' };
        if (!code || code.length < 4) return { ok: false, message: 'Invalid code' };
        if (code.toUpperCase() === user.referralCode)
          return { ok: false, message: 'Cannot use your own code' };
        set({
          user: {
            ...user,
            referredBy: code.toUpperCase(),
            balance: user.balance + 100,
          },
        });
        return { ok: true, message: '+100 virtual Birr referral bonus!' };
      },
    }),
    { name: 'fast-equb-demo-v2' },
  ),
);
