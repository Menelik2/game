import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EqubRoom, EqubMember, buildCatalog, contributionOf } from './equb.types';
import { cryptographicDraw } from './equb-crypto';

@Injectable()
export class EqubService {
  private instances = new Map<string, EqubRoom>();

  listTemplates() {
    return buildCatalog(9000).map((t) => {
      const live = this.findOpenInstance(t.id);
      return {
        ...t,
        liveRoomId: live?.id ?? null,
        seatsTaken: live?.members.length ?? 0,
        status: (live?.status ?? 'open') as string,
      };
    });
  }

  private findOpenInstance(templateId: string): EqubRoom | undefined {
    for (const r of this.instances.values()) {
      if (r.id.startsWith(templateId + '-') && r.status === 'open') return r;
    }
    return undefined;
  }

  getRoom(roomId: string): EqubRoom {
    const room = this.instances.get(roomId);
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  ensureOpenRoom(templateId: string): EqubRoom {
    const existing = this.findOpenInstance(templateId);
    if (existing) return existing;

    const match = /^equb-(\d+)-(\d+)$/.exec(templateId);
    if (!match) throw new BadRequestException('Invalid room template');
    const groupSize = parseInt(match[1], 10);
    const prizePool = parseInt(match[2], 10);
    const contribution = contributionOf(prizePool, groupSize);
    const tier = prizePool <= 500 ? 'entry' : prizePool < 10000 ? 'low' : 'mid';

    const instanceId = `${templateId}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const room: EqubRoom = {
      id: instanceId,
      groupSize,
      prizePool,
      contribution,
      tier,
      status: 'open',
      members: [],
      winningNumber: null,
      winnerId: null,
      entropyHex: null,
      commitmentHash: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.instances.set(instanceId, room);
    return room;
  }

  join(templateId: string, player: { playerId: string; name: string }, pick: number): EqubRoom {
    const template = /^equb-\d+-\d+$/.test(templateId)
      ? templateId
      : templateId.match(/^equb-\d+-\d+/)?.[0];
    if (!template) throw new BadRequestException('Invalid template');

    const room = this.ensureOpenRoom(template);

    if (room.status !== 'open') throw new ConflictException('Room is closed');
    if (room.members.some((m) => m.playerId === player.playerId))
      throw new ConflictException('Already joined');
    if (room.members.length >= room.groupSize)
      throw new ConflictException('Room is full');
    if (pick < 1 || pick > room.groupSize)
      throw new BadRequestException(`Pick must be 1..${room.groupSize}`);
    if (room.members.some((m) => m.pick === pick))
      throw new ConflictException(`Number ${pick} is taken`);

    room.members.push({
      playerId: player.playerId,
      name: (player.name || 'Player').slice(0, 40),
      pick,
      joinedAt: Date.now(),
    });
    room.updatedAt = Date.now();
    this.instances.set(room.id, room);
    return room;
  }

  draw(roomId: string, playerId: string): EqubRoom {
    const room = this.getRoom(roomId);
    if (room.status === 'completed') throw new ConflictException('Already drawn');
    if (!room.members.some((m) => m.playerId === playerId))
      throw new BadRequestException('Only members can draw');
    if (room.members.length < room.groupSize)
      throw new BadRequestException(`Need ${room.groupSize} players (have ${room.members.length})`);

    const proof = cryptographicDraw(room.groupSize);
    const winner = room.members.find((m) => m.pick === proof.winningNumber);
    if (!winner) throw new BadRequestException('Draw mapping failed');

    room.status = 'completed';
    room.winningNumber = proof.winningNumber;
    room.winnerId = winner.playerId;
    room.entropyHex = proof.entropyHex;
    room.commitmentHash = proof.commitmentHash;
    room.updatedAt = Date.now();
    this.instances.set(room.id, room);
    return room;
  }

  listLiveRooms(): EqubRoom[] {
    return [...this.instances.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
