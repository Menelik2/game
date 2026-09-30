import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { EqubService } from './equb.service';
import { EqubGateway } from './equb.gateway';
import { IsInt, IsString, Min, Max, MinLength, MaxLength } from 'class-validator';

class JoinDto {
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  playerId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  pick!: number;
}

class DrawDto {
  @IsString()
  @MinLength(4)
  playerId!: string;
}

@Controller('equb')
export class EqubController {
  constructor(
    private readonly equb: EqubService,
    private readonly gateway: EqubGateway,
  ) {}

  @Get('templates')
  templates() {
    return this.equb.listTemplates();
  }

  @Get('rooms')
  rooms() {
    return this.equb.listLiveRooms();
  }

  @Get('rooms/:id')
  getRoom(@Param('id') id: string) {
    return this.equb.getRoom(id);
  }

  @Post('rooms/:templateId/join')
  join(@Param('templateId') templateId: string, @Body() body: JoinDto) {
    const room = this.equb.join(
      templateId,
      { playerId: body.playerId, name: body.name },
      body.pick,
    );
    this.gateway.broadcastRoom(room.id);
    return room;
  }

  @Post('rooms/:roomId/draw')
  draw(@Param('roomId') roomId: string, @Body() body: DrawDto) {
    const room = this.equb.draw(roomId, body.playerId);
    this.gateway.broadcastRoom(room.id);
    return room;
  }

  @Post('rooms/:templateId/open')
  open(@Param('templateId') templateId: string) {
    return this.equb.ensureOpenRoom(templateId);
  }
}
