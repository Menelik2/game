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
  contributionOf,
} from './equb-logic';
import {
  equbDraw,
  equbErrorMessage,
  equbFillBots,
  equbGetRoom,
  equbJoin,
  equbPing,
  equbTemplates,
} from './equb-api';
import { isApiConfigured } from './api';

type Lang = 'am' | 'en';

type EqubState = {
  user: EqubUser | null;
  rooms: EqubRoom[];
  history: EqubHistoryItem[];
  lang: Lang;
  /** true when Nest /equb responds */
  live: boolean;
  /** templateId → live Nest instance id */
  liveRoomIds: Record<string, string>;
  register: (name: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  setLang: (lang: Lang) => void;
  refreshLive: () => Promise<void>;
  syncLiveRoom: (templateId: string) => Promise<EqubRoom | null>;
  joinRoom: (
    groupSize: number,
    prizePool: number,
    pick: number,
  ) => Promise<{ ok: true; room: EqubRoom } | { ok: false; error: string }>;
  fillAndDraw: (
    roomIdOrTemplateId: string,
  ) => Promise<{ ok: true; room: EqubRoom } | { ok: false; error: string }>;
  resetRoom: (roomIdOrTemplateId: string) => void;
};

function ensureRooms(rooms: EqubRoom[]): EqubRoom[] {
  if (!rooms?.length) return buildTemplates(9000);
  return rooms;
}

function mergeLiveIntoLocal(
  local: EqubRoom[],
  liveRoom: EqubRoom,
  templateId: string,
): EqubRoom[] {
  // Keep template row id as equb-size-prize for UI selection; overlay members from live
  return ensureRooms(local).map((r) => {
    if (r.id === templateId || r.id === liveRoom.id) {
      return {
        ...liveRoom,
        // Preserve template id for picker keys when possible
        id: templateId,
      };
    }
    return r;
  });
}

export const useEqubStore = create<EqubState>()(
  persist(
    (set, get) => ({
      user: null,
      rooms: buildTemplates(9000),
      history: [],
      lang: 'am',
      live: false,
      liveRoomIds: {},

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

      refreshLive: async () => {
        if (!isApiConfigured()) {
          set({ live: false });
          return;
        }
        const ok = await equbPing();
        set({ live: ok });
        if (!ok) return;
        try {
          const templates = await equbTemplates();
          const { rooms, liveRoomIds } = get();
          const nextIds = { ...liveRoomIds };
          const nextRooms = ensureRooms(rooms).map((r) => {
            const t = templates.find((x) => x.id === r.id);
            if (!t) return r;
            if (t.liveRoomId) nextIds[r.id] = t.liveRoomId;
            return {
              ...r,
              status: (t.status as EqubRoom['status']) || r.status,
              members:
                t.seatsTaken === 0 && r.status === 'open'
                  ? []
                  : r.members.length
                    ? r.members
                    : r.members,
            };
          });
          set({ rooms: nextRooms, liveRoomIds: nextIds, live: true });
        } catch {
          set({ live: false });
        }
      },

      syncLiveRoom: async (templateId: string) => {
        const { liveRoomIds, rooms } = get();
        const instanceId = liveRoomIds[templateId];
        if (!instanceId || !isApiConfigured()) return null;
        try {
          const liveRoom = await equbGetRoom(instanceId);
          set({
            rooms: mergeLiveIntoLocal(rooms, liveRoom, templateId),
            live: true,
          });
          return liveRoom;
        } catch {
          return null;
        }
      },

      joinRoom: async (groupSize, prizePool, pick) => {
        const { user, rooms, liveRoomIds, history } = get();
        if (!user) return { ok: false, error: 'Register first' };

        const templateId = roomIdOf(groupSize, prizePool);
        const contribution = contributionOf(prizePool, groupSize);

        if (user.balance < contribution) {
          return { ok: false, error: 'Insufficient balance' };
        }

        // —— Live Nest path ——
        if (isApiConfigured()) {
          try {
            const liveRoom = await equbJoin(templateId, {
              playerId: user.playerId,
              name: user.name,
              pick,
            });
            const nextUser: EqubUser = {
              ...user,
              balance: Math.round((user.balance - contribution) * 100) / 100,
            };
            set({
              user: nextUser,
              live: true,
              liveRoomIds: { ...liveRoomIds, [templateId]: liveRoom.id },
              rooms: mergeLiveIntoLocal(rooms, liveRoom, templateId),
            });
            return { ok: true, room: { ...liveRoom, id: templateId } };
          } catch (err) {
            // fall through to local if network/API offline
            const msg = equbErrorMessage(err);
            if (!/unreachable|offline|Network|API not available/i.test(msg)) {
              return { ok: false, error: msg };
            }
            set({ live: false });
          }
        }

        // —— Local offline path ——
        let room = rooms.find((r) => r.id === templateId);
        if (!room) return { ok: false, error: 'Room not found' };

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

        if (room.status !== 'open') return { ok: false, error: 'Room is not open' };
        if (pick < 1 || pick > room.groupSize) {
          return { ok: false, error: `Pick must be 1–${room.groupSize}` };
        }
        if (room.members.some((m) => m.pick === pick)) {
          return { ok: false, error: `Number ${pick} is taken` };
        }
        if (room.members.some((m) => m.playerId === user.playerId)) {
          return { ok: false, error: 'You already joined this round' };
        }

        const nextRoom: EqubRoom = {
          ...room,
          members: [
            ...room.members,
            {
              playerId: user.playerId,
              name: user.name,
              pick,
              joinedAt: Date.now(),
              isBot: false,
            },
          ],
          updatedAt: Date.now(),
        };

        set({
          user: {
            ...user,
            balance: Math.round((user.balance - contribution) * 100) / 100,
          },
          rooms: ensureRooms(rooms).map((r) => (r.id === templateId ? nextRoom : r)),
        });

        return { ok: true, room: nextRoom };
      },

      fillAndDraw: async (roomIdOrTemplateId) => {
        const { user, rooms, liveRoomIds, history } = get();
        if (!user) return { ok: false, error: 'Register first' };

        const templateId = roomIdOrTemplateId.match(/^equb-\d+-\d+/)
          ? roomIdOrTemplateId.match(/^equb-\d+-\d+/)![0]
          : roomIdOrTemplateId;
        const instanceId = liveRoomIds[templateId] || roomIdOrTemplateId;

        // —— Live Nest path ——
        if (isApiConfigured() && get().live !== false) {
          try {
            let liveRoom =
              instanceId !== templateId
                ? await equbGetRoom(instanceId).catch(() => null)
                : null;

            if (!liveRoom) {
              // try join path id from templates
              liveRoom = await equbGetRoom(instanceId);
            }

            if (!liveRoom.members.some((m) => m.playerId === user.playerId)) {
              return { ok: false, error: 'Join the room first' };
            }

            const need = liveRoom.groupSize - liveRoom.members.length;
            if (need > 0) {
              liveRoom = await equbFillBots(liveRoom.id, need);
            }

            liveRoom = await equbDraw(liveRoom.id, user.playerId);

            const won = liveRoom.winnerId === user.playerId;
            const myMember = liveRoom.members.find((m) => m.playerId === user.playerId);
            let nextBalance = user.balance;
            if (won) {
              nextBalance = Math.round((user.balance + liveRoom.prizePool) * 100) / 100;
            }

            const hist: EqubHistoryItem = {
              id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              roomId: templateId,
              groupSize: liveRoom.groupSize,
              prizePool: liveRoom.prizePool,
              contribution: liveRoom.contribution,
              pick: myMember?.pick ?? 0,
              winningNumber: liveRoom.winningNumber || 0,
              won,
              delta: won ? liveRoom.prizePool : -liveRoom.contribution,
              at: Date.now(),
            };

            set({
              user: { ...user, balance: nextBalance },
              live: true,
              rooms: mergeLiveIntoLocal(rooms, liveRoom, templateId),
              history: [hist, ...history].slice(0, 100),
            });

            return { ok: true, room: { ...liveRoom, id: templateId } };
          } catch (err) {
            const msg = equbErrorMessage(err);
            if (!/unreachable|offline|Network|API not available|not found/i.test(msg)) {
              return { ok: false, error: msg };
            }
            set({ live: false });
          }
        }

        // —— Local offline path ——
        let room = rooms.find((r) => r.id === templateId);
        if (!room) return { ok: false, error: 'Room not found' };
        if (room.status === 'completed') return { ok: false, error: 'Already drawn' };
        if (!room.members.some((m) => m.playerId === user.playerId)) {
          return { ok: false, error: 'Join the room first' };
        }

        const need = room.groupSize - room.members.length;
        let members = room.members;
        if (need > 0) members = [...room.members, ...fillBots(room, need)];
        if (members.length < 2) return { ok: false, error: 'Need at least 2 players' };

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
        if (won) nextBalance = Math.round((user.balance + room.prizePool) * 100) / 100;

        const hist: EqubHistoryItem = {
          id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          roomId: templateId,
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
          rooms: rooms.map((r) => (r.id === templateId ? completed : r)),
          history: [hist, ...history].slice(0, 100),
        });

        return { ok: true, room: completed };
      },

      resetRoom: (roomIdOrTemplateId) => {
        const templateId = roomIdOrTemplateId.match(/^equb-\d+-\d+/)
          ? roomIdOrTemplateId.match(/^equb-\d+-\d+/)![0]
          : roomIdOrTemplateId;
        const { rooms, liveRoomIds } = get();
        const nextIds = { ...liveRoomIds };
        delete nextIds[templateId];
        set({
          liveRoomIds: nextIds,
          rooms: rooms.map((r) =>
            r.id === templateId
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
      version: 2,
      partialize: (s) => ({
        user: s.user,
        rooms: s.rooms,
        history: s.history,
        lang: s.lang,
        liveRoomIds: s.liveRoomIds,
      }),
    },
  ),
);
