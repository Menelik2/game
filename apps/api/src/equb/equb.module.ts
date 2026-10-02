import { Module, OnModuleInit } from '@nestjs/common';
import { EqubService } from './equb.service';
import { EqubController } from './equb.controller';
import { EqubGateway } from './equb.gateway';

@Module({
  controllers: [EqubController],
  providers: [EqubService, EqubGateway],
  exports: [EqubService],
})
export class EqubModule implements OnModuleInit {
  constructor(
    private readonly equb: EqubService,
    private readonly gateway: EqubGateway,
  ) {}

  onModuleInit() {
    this.equb.setBroadcast((roomId) => this.gateway.broadcastRoom(roomId));
  }
}
