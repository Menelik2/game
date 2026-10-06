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
  splitPot,
} from './equb.types';
import { cryptographicDraw, secureRandomInt } from './equb-crypto';

const BOT_NAMES = [
  'Abebe', 'Tigist', 'Yonas', 'Hanna', 'Dawit', 'Meron', 'Kaleb', 'Sara',
  'Biruk', 'Selam', 'Nahom', 'Rahel', 'Elias', 'Kidist', 'Samuel', 'Bethlehem',
];

/**
 * Multiplayer Equb
 * - Many distinct playerIds (accounts) join the same open room
 * - Each pick is unique
 * - Draw selects EXACTLY ONE winner among joined members
 */
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
      winnerName: null,
      adminFee: null,
      winnerPayout: null,
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

    // Full open room → close it and open a new instance (do not wipe mid-join)
    if (room.members.length >= room.groupSize) {
      if (room.status === 'open') {
        this.executeDraw(room);
      }
      room = this.ensureOpenRoom(template);
    }

    const playerId = String(player.playerId || '').trim();
    if (!playerId || playerId.length < 4) {
      throw new BadRequestException('Valid playerId required');
    }

    // Same account cannot join twice in one round
    if (room.members.some((m) => m.playerId === playerId)) {
      throw new ConflictException('Already joined this round — wait for draw');
    }
    if (pick < 1 || pick > room.groupSize) {
      throw new BadRequestException(`Pick must be 1..${room.groupSize}`);
    }
    if (room.members.some((m) => m.pick === pick)) {
      throw new ConflictException(`Number ${pick} is taken`);
    }

    const member: EqubMember = {
      playerId,
      name: (player.name || 'Player').slice(0, 40),
      pick,
      joinedAt: Date.now(),
    };
    room.members.push(member);
    room.updatedAt = Date.now();
    this.instances.set(room.id, room);
    this.logger.log(
      `Join ${room.id}: ${member.name} (#${pick}) — ${room.members.length}/${room.groupSize} players`,
    );
    return this.withTimer(room);
  }

  fillBots(roomId: string, count?: number): EqubRoom {
    const room = this.instances.get(roomId);
    if (!room) throw new NotFoundException('Room not found');
    if (room.status !== 'open') throw new ConflictException('Room not open');

    const taken = new Set(room.members.map((m) => m.pick));
    const available: number[] = [];
    for (let n = 1; n <= room.groupSize; n++) {
      if (!taken.has(n)) available.push(n);
    }
    for (let i = available.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [available[i], available[j]] = [available[j]!, available[i]!];
    }

    const need = Math.min(
      count ?? available.length,
      available.length,
      room.groupSize - room.members.length,
    );

    for (let i = 0; i < need; i++) {
      const name =
        BOT_NAMES[secureRandomInt(BOT_NAMES.length)]! +
        (100 + secureRandomInt(900));
      room.members.push({
        playerId: `bot-${Date.now()}-${i}-${secureRandomInt(1e6)}`,
        name,
        pick: available[i]!,
        joinedAt: Date.now(),
      });
    }
    room.updatedAt = Date.now();
    this.instances.set(room.id, room);
    this.broadcast?.(room.id);
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

  /**
   * Fair single-winner draw among joined members only.
   * Uniform random index over members[] → exactly one winnerId.
   */
  private executeDraw(room: EqubRoom): EqubRoom {
    if (room.status === 'completed') return room;
    room.status = 'drawing';
    const members = room.members;
    if (members.length < 1) {
      throw new BadRequestException('No members');
    }

    // Exactly ONE winner among real joined seats
    const idx = secureRandomInt(members.length);
    const winner = members[idx]!;
    const proof = cryptographicDraw(Math.max(2, room.groupSize));
    const { adminFee, winnerPayout } = splitPot(room.prizePool);

    room.status = 'completed';
    room.winningNumber = winner.pick;
    room.winnerId = winner.playerId;
    room.winnerName = winner.name;
    room.adminFee = adminFee;
    room.winnerPayout = winnerPayout;
    room.entropyHex = proof.entropyHex;
    room.commitmentHash = proof.commitmentHash;
    room.updatedAt = Date.now();
    room.secondsLeft = 0;
    this.instances.set(room.id, room);
    this.logger.log(
      `Draw ${room.id}: ONE winner ${winner.name} (#${winner.pick}) payout=${winnerPayout} fee=${adminFee} among ${members.length} players`,
    );
    this.broadcast?.(room.id);
    // Open next round instance for other players
    this.ensureOpenRoom(room.templateId || room.id.match(/^equb-\d+-\d+/)![0]);
    return room;
  }

  private tick() {
    const now = Date.now();
    for (const room of this.instances.values()) {
      if (room.status !== 'open') continue;
      // Full table of different accounts → draw once
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
