import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResponsibleGamingLimit } from './entities/responsible-gaming-limit.entity';
import { SelfExclusion } from './entities/self-exclusion.entity';
import { ResponsibleGamingService } from './responsible-gaming.service';
import { ResponsibleGamingController } from './responsible-gaming.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ResponsibleGamingLimit, SelfExclusion])],
  providers: [ResponsibleGamingService],
  controllers: [ResponsibleGamingController],
  exports: [ResponsibleGamingService],
})
export class ResponsibleGamingModule {}
