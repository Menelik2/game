import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  EqubRoom,
  EqubMember,
  buildCatalog,
  contributionOf,
  ROUND_MS,
} from './equb.types';
import { cryptographicDraw, secureRandomInt } from './equb-crypto';

/** Multiplayer Equb — unlimited successive rounds. */
@Injectable()
export class EqubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EqubService.name);
  private instances = new Map<string, EqubRoom>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private broadcast?: (roomId: string) => void;

  setBroadcast(fn: (roomId: string) => void) {
    this.broadcast = fn;
  }

  onModuleInit() {
    this.timer = setInterval(() => this.tick(), 2000);
    this.logger.log(`Equb scheduler started (round=${ROUND_MS / 1000}s)`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private withTimer(room: EqubRoom): EqubRoom {
    const secondsLeft = Math.max(0, Math.ceil((room.drawAt - Date.now()) / 1000));
    return { ...room, secondsLeft };
  }

  listTemplates() {
    return buildCatalog(9000).map((t) => {
      const live = this.findOpenInstance(t.id);
      return {
        ...t,
        liveRoomId: live?.id ?? null,
        seatsTaken: live?.members.length ?? 0,
        status: (live?.status ?? 'open') as string,
        secondsLeft: live
          ? this.withTimer(live).secondsLeft
          : Math.ceil(ROUND_MS / 1000),
      };
    });
  }

  private findOpenInstance(templateId: string): EqubRoom | undefined {
    for (const r of this.instances.values()) {
      if (r.templateId === templateId && r.status === 'open') return r;
    }
    for (const r of this.instances.values()) {
      if (r.id.startsWith(templateId + '-') && r.status === 'open') return r;
    }
    return undefined;
  }

  getRoom(roomId: string): EqubRoom {
    const room = this.instances.get(roomId);
    if (!room) throw new NotFoundException('Room not found');
    return this.withTimer(room);
  }

  ensureOpenRoom(templateId: string): EqubRoom {
    const existing = this.findOpenInstance(templateId);
    if (existing) return this.withTimer(existing);

    const match = /^equb-(\d+)-(\d+)$/.exec(templateId);
    if (!match) throw new BadRequestException('Invalid room template');
    const groupSize = parseInt(match[1], 10);
    const prizePool = parseInt(match[2], 10);
    const contribution = contributionOf(prizePool, groupSize);
    const tier = prizePool <= 500 ? 'entry' : prizePool < 10000 ? 'low' : 'mid';

    const instanceId = `${templateId}-${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    const now = Date.now();
    const room: EqubRoom = {
      id: instanceId,
      templateId,
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
      drawAt: now + ROUND_MS,
      secondsLeft: Math.ceil(ROUND_MS / 1000),
      createdAt: now,
      updatedAt: now,
    };
    this.instances.set(instanceId, room);
    return this.withTimer(room);
  }

  join(
    templateId: string,
    player: { playerId: string; name: string },
    pick: number,
  ): EqubRoom {
    const template = /^equb-\d+-\d+$/.test(templateId)
      ? templateId
      : templateId.match(/^equb-\d+-\d+/)?.[0];
    if (!template) throw new BadRequestException('Invalid template');

    let room = this.ensureOpenRoom(template);

    if (room.members.length >= room.groupSize) {
      room.status = 'completed';
      this.instances.set(room.id, room);
      room = this.ensureOpenRoom(template);
    }

    if (room.members.some((m) => m.playerId === player.playerId)) {
      throw new ConflictException('Already joined this round — wait for draw');
    }
    if (pick < 1 || pick > room.groupSize) {
      throw new BadRequestException(`Pick must be 1..${room.groupSize}`);
    }
    if (room.members.some((m) => m.pick === pick)) {
      throw new ConflictException(`Number ${pick} is taken`);
    }

    const member: EqubMember = {
      playerId: player.playerId,
      name: (player.name || 'Player').slice(0, 40),
      pick,
      joinedAt: Date.now(),
    };
    room.members.push(member);
    room.updatedAt = Date.now();
    this.instances.set(room.id, room);
    return this.withTimer(room);
  }

  draw(roomId: string, playerId?: string): EqubRoom {
    const room = this.instances.get(roomId);
    if (!room) throw new NotFoundException('Room not found');
    if (room.status === 'completed') throw new ConflictException('Already drawn');
    if (playerId && !room.members.some((m) => m.playerId === playerId)) {
      throw new BadRequestException('Only members can request draw');
    }
    if (room.members.length < 2) {
      throw new BadRequestException('Need at least 2 players');
    }
    return this.withTimer(this.executeDraw(room));
  }

  /** Fair draw: uniform among members who actually joined (their picks only). */
  private executeDraw(room: EqubRoom): EqubRoom {
    room.status = 'drawing';
    const members = room.members;
    if (members.length < 1) {
      throw new BadRequestException('No members');
    }

    const idx = secureRandomInt(members.length);
    const winner = members[idx]!;
    const proof = cryptographicDraw(room.groupSize);

    room.status = 'completed';
    room.winningNumber = winner.pick;
    room.winnerId = winner.playerId;
    room.entropyHex = proof.entropyHex;
    room.commitmentHash = proof.commitmentHash;
    room.updatedAt = Date.now();
    room.secondsLeft = 0;
    this.instances.set(room.id, room);
    this.logger.log(`Draw ${room.id}: #${winner.pick} → ${winner.name}`);
    this.broadcast?.(room.id);
    this.ensureOpenRoom(room.templateId || room.id.match(/^equb-\d+-\d+/)![0]);
    return room;
  }

  private tick() {
    const now = Date.now();
    for (const room of this.instances.values()) {
      if (room.status !== 'open') continue;
      if (room.members.length >= room.groupSize) {
        this.executeDraw(room);
        continue;
      }
      if (now >= room.drawAt && room.members.length >= 2) {
        this.executeDraw(room);
        continue;
      }
      if (now >= room.drawAt && room.members.length < 2) {
        room.drawAt = now + ROUND_MS;
        room.updatedAt = now;
        this.instances.set(room.id, room);
      }
    }
  }

  listLiveRooms(): EqubRoom[] {
    return [...this.instances.values()]
      .map((r) => this.withTimer(r))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
