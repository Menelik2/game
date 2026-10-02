'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  EqubHistoryItem,
  EqubRoom,
  EqubUser,
  STARTING_BALANCE,
  buildTemplates,
  fairDrawAmongMembers,
  fillBots,
  newPlayerId,
  roomIdOf,
} from './equb-logic';

type Lang = 'am' | 'en';

type EqubState = {
  user: EqubUser | null;
  rooms: EqubRoom[];
  history: EqubHistoryItem[];
  lang: Lang;
  register: (name: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  setLang: (lang: Lang) => void;
  joinRoom: (
    groupSize: number,
    prizePool: number,
    pick: number,
  ) => Promise<{ ok: true; room: EqubRoom } | { ok: false; error: string }>;
  fillAndDraw: (
    roomId: string,
  ) => Promise<{ ok: true; room: EqubRoom } | { ok: false; error: string }>;
  resetRoom: (roomId: string) => void;
};

function ensureRooms(rooms: EqubRoom[]): EqubRoom[] {
  if (!rooms?.length) return buildTemplates(9000);
  return rooms;
}

export const useEqubStore = create<EqubState>()(
  persist(
    (set, get) => ({
      user: null,
      rooms: buildTemplates(9000),
      history: [],
      lang: 'am',

      register: (name: string) => {
        const trimmed = name.trim().slice(0, 40);
        if (trimmed.length < 2) {
          return { ok: false as const, error: 'Name must be at least 2 characters' };
        }
        const user: EqubUser = {
          playerId: newPlayerId(),
          name: trimmed,
          balance: STARTING_BALANCE,
          createdAt: Date.now(),
        };
        set({ user });
        return { ok: true as const };
      },

      logout: () => set({ user: null }),

      setLang: (lang) => set({ lang }),

      joinRoom: async (groupSize, prizePool, pick) => {
        const { user, rooms } = get();
        if (!user) return { ok: false, error: 'Register first' };

        const id = roomIdOf(groupSize, prizePool);
        let room = rooms.find((r) => r.id === id);
        if (!room) {
          return { ok: false, error: 'Room not found' };
        }

        // Fresh open instance if previous completed
        if (room.status === 'completed') {
          room = {
            ...room,
            status: 'open',
            members: [],
            winningNumber: null,
            winnerId: null,
            entropyHex: null,
            commitmentHash: null,
            updatedAt: Date.now(),
          };
        }

        if (room.status !== 'open') {
          return { ok: false, error: 'Room is not open' };
        }
        if (pick < 1 || pick > room.groupSize) {
          return { ok: false, error: `Pick must be 1–${room.groupSize}` };
        }
        if (room.members.some((m) => m.pick === pick)) {
          return { ok: false, error: `Number ${pick} is taken` };
        }
        if (room.members.some((m) => m.playerId === user.playerId)) {
          return { ok: false, error: 'You already joined this round' };
        }
        if (user.balance < room.contribution) {
          return { ok: false, error: 'Insufficient balance' };
        }

        const member = {
          playerId: user.playerId,
          name: user.name,
          pick,
          joinedAt: Date.now(),
          isBot: false,
        };

        const nextRoom: EqubRoom = {
          ...room,
          members: [...room.members, member],
          updatedAt: Date.now(),
        };

        const nextUser: EqubUser = {
          ...user,
          balance: Math.round((user.balance - room.contribution) * 100) / 100,
        };

        set({
          user: nextUser,
          rooms: ensureRooms(rooms).map((r) => (r.id === id ? nextRoom : r)),
        });

        return { ok: true, room: nextRoom };
      },

      fillAndDraw: async (roomId) => {
        const { user, rooms, history } = get();
        if (!user) return { ok: false, error: 'Register first' };

        let room = rooms.find((r) => r.id === roomId);
        if (!room) return { ok: false, error: 'Room not found' };
        if (room.status === 'completed') return { ok: false, error: 'Already drawn' };

        // Must have current user in room
        if (!room.members.some((m) => m.playerId === user.playerId)) {
          return { ok: false, error: 'Join the room first' };
        }

        // Fill remaining seats with demo bots
        const need = room.groupSize - room.members.length;
        let members = room.members;
        if (need > 0) {
          const bots = fillBots(room, need);
          members = [...room.members, ...bots];
        }

        if (members.length < 2) {
          return { ok: false, error: 'Need at least 2 players' };
        }

        set({
          rooms: rooms.map((r) =>
            r.id === roomId
              ? { ...r, members, status: 'drawing' as const, updatedAt: Date.now() }
              : r,
          ),
        });

        const proof = await fairDrawAmongMembers(members);
        const completed: EqubRoom = {
          ...room,
          members,
          status: 'completed',
          winningNumber: proof.winningNumber,
          winnerId: proof.winnerId,
          entropyHex: proof.entropyHex,
          commitmentHash: proof.commitmentHash,
          updatedAt: Date.now(),
        };

        const myMember = members.find((m) => m.playerId === user.playerId);
        const won = proof.winnerId === user.playerId;
        let nextBalance = user.balance;
        if (won) {
          nextBalance = Math.round((user.balance + room.prizePool) * 100) / 100;
        }

        const hist: EqubHistoryItem = {
          id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          roomId,
          groupSize: room.groupSize,
          prizePool: room.prizePool,
          contribution: room.contribution,
          pick: myMember?.pick ?? 0,
          winningNumber: proof.winningNumber,
          won,
          delta: won ? room.prizePool : -room.contribution,
          at: Date.now(),
        };

        set({
          user: { ...user, balance: nextBalance },
          rooms: rooms.map((r) => (r.id === roomId ? completed : r)),
          history: [hist, ...history].slice(0, 100),
        });

        return { ok: true, room: completed };
      },

      resetRoom: (roomId) => {
        const { rooms } = get();
        set({
          rooms: rooms.map((r) =>
            r.id === roomId
              ? {
                  ...r,
                  status: 'open' as const,
                  members: [],
                  winningNumber: null,
                  winnerId: null,
                  entropyHex: null,
                  commitmentHash: null,
                  updatedAt: Date.now(),
                }
              : r,
          ),
        });
      },
    }),
    {
      name: 'fast-equb-v2',
      version: 1,
      partialize: (s) => ({
        user: s.user,
        rooms: s.rooms,
        history: s.history,
        lang: s.lang,
      }),
    },
  ),
);
