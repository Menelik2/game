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

type State = {
  user: User | null;
  rooms: LiveRoom[];
  loginDemo: (name?: string) => void;
  logout: () => void;
  ensureRooms: () => void;
  joinRoom: (roomId: string) => { ok: boolean; message: string };
  advanceRound: (roomId: string) => { ok: boolean; message: string };
  claimReferral: (code: string) => { ok: boolean; message: string };
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

const STARTER_BALANCE = 5000;

export const useEqubStore = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      rooms: [],

      loginDemo: (name) => {
        const id = uid();
        set({
          user: {
            id,
            name: name || 'Equb Player',
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
        const rooms: LiveRoom[] = templates.map((t) => ({
          ...t,
          members: [],
          status: 'open' as const,
          currentRound: 1,
          createdAt: Date.now(),
        }));
        set({ rooms });
      },

      joinRoom: (roomId) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, message: 'Please sign in first' };
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, message: 'Room not found' };
        if (room.status === 'completed') return { ok: false, message: 'Room completed' };
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
        let status = room.status;
        let currentRound = room.currentRound;

        if (newMembers.length >= room.groupSize) {
          const positions = shufflePositions(newMembers.length);
          newMembers.forEach((m, i) => {
            m.position = positions[i];
          });
          newMembers.sort((a, b) => a.position - b.position);
          status = 'active';
          currentRound = 1;
        }

        set({
          user: { ...user, balance: Math.round((user.balance - fee) * 100) / 100 },
          rooms: rooms.map((r) =>
            r.id === roomId ? { ...r, members: newMembers, status, currentRound } : r,
          ),
        });

        return {
          ok: true,
          message:
            status === 'active'
              ? `Room locked! You are position #${newMembers.find((m) => m.id === user.id)?.position}`
              : `Joined. Paid ${fee} virtual Birr. ${room.groupSize - newMembers.length} seats left.`,
        };
      },

      advanceRound: (roomId) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, message: 'Sign in first' };
        const room = rooms.find((r) => r.id === roomId);
        if (!room || room.status !== 'active')
          return { ok: false, message: 'Room not active' };

        const sorted = [...room.members].sort((a, b) => a.position - b.position);
        const recipient = sorted.find((m) => !m.hasReceived);
        if (!recipient) {
          set({
            rooms: rooms.map((r) =>
              r.id === roomId ? { ...r, status: 'completed' as const } : r,
            ),
          });
          return { ok: true, message: 'All members have received. Cycle complete!' };
        }

        const updatedMembers = room.members.map((m) =>
          m.id === recipient.id ? { ...m, hasReceived: true } : m,
        );
        const allDone = updatedMembers.every((m) => m.hasReceived);
        let newBalance = user.balance;
        if (recipient.id === user.id) {
          newBalance = Math.round((user.balance + room.prizePool) * 100) / 100;
        }

        set({
          user: { ...user, balance: newBalance },
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
          message:
            recipient.id === user.id
              ? `You received ${room.prizePool.toLocaleString()} virtual Birr!`
              : `${recipient.name} received the pot (${room.prizePool.toLocaleString()} Birr).`,
        };
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
    { name: 'fast-equb-demo-v1' },
  ),
);
