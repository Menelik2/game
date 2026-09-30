import { Module } from '@nestjs/common';
import { EqubService } from './equb.service';
import { EqubController } from './equb.controller';
import { EqubGateway } from './equb.gateway';

@Module({
  controllers: [EqubController],
  providers: [EqubService, EqubGateway],
  exports: [EqubService],
})
export class EqubModule {}
