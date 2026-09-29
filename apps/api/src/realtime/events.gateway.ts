import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: process.env.APP_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/realtime',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (!token) {
        client.disconnect();
        return;
      }
      const decoded = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_SECRET'),
      });
      const userId = decoded.sub as string;
      client.data.userId = userId;
      if (!this.userSockets.has(userId)) this.userSockets.set(userId, new Set());
      this.userSockets.get(userId)!.add(client.id);
      client.join(`user:${userId}`);
      this.logger.debug(`WS connected user=${userId}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId as string | undefined;
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id);
      if (this.userSockets.get(userId)!.size === 0) this.userSockets.delete(userId);
    }
  }

  emitWalletUpdate(
    userId: string,
    payload: {
      availableBalance: number;
      lockedBalance: number;
      bonusBalance: number;
      currency: string;
    },
  ) {
    this.server.to(`user:${userId}`).emit('wallet:update', payload);
  }

  emitJackpotUpdate(payload: { slug: string; amount: number; currency: string }) {
    this.server.emit('jackpot:update', payload);
  }

  @SubscribeMessage('jackpot:subscribe')
  handleJackpotSubscribe(@ConnectedSocket() client: Socket) {
    client.join('jackpots');
    return { ok: true };
  }
}
