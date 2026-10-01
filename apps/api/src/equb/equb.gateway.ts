import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { EqubService } from './equb.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/equb',
})
export class EqubGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EqubGateway.name);

  constructor(private readonly equb: EqubService) {}

  handleConnection(client: Socket) {
    this.logger.debug(`Equb WS connected ${client.id}`);
  }

  @SubscribeMessage('equb:subscribe')
  onSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId: string },
  ) {
    if (body?.roomId) {
      client.join(`equb:${body.roomId}`);
      try {
        const room = this.equb.getRoom(body.roomId);
        return { event: 'equb:state', data: room };
      } catch {
        return { event: 'equb:error', data: { message: 'Room not found' } };
      }
    }
  }

  broadcastRoom(roomId: string) {
    try {
      const room = this.equb.getRoom(roomId);
      this.server.to(`equb:${roomId}`).emit('equb:update', room);
      this.server.emit('equb:lobby', {
        roomId,
        seats: room.members.length,
        status: room.status,
      });
    } catch {
      /* ignore */
    }
  }
}
