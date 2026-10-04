import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard stats' })
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('health')
  @ApiOperation({ summary: 'System health' })
  health() {
    return this.adminService.systemHealth();
  }

  @Get('users')
  @ApiOperation({ summary: 'List users' })
  listUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('q') q?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.listUsers(
      Number(page) || 1,
      Number(limit) || 20,
      q,
      status,
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'User detail' })
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id/status')
  setStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' },
  ) {
    return this.adminService.setUserStatus(id, body.status);
  }

  @Patch('users/:id/admin')
  setAdmin(@Param('id') id: string, @Body() body: { isAdmin: boolean }) {
    return this.adminService.setUserAdmin(id, !!body.isAdmin);
  }

  @Post('users/:id/credit')
  @ApiOperation({ summary: 'Credit demo wallet' })
  credit(
    @Param('id') id: string,
    @Body() body: { amount: number; note?: string },
  ) {
    return this.adminService.creditUser(id, Number(body.amount), body.note);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Audit log' })
  audit(@Query('page') page = 1, @Query('limit') limit = 30) {
    return this.adminService.listAudit(Number(page) || 1, Number(limit) || 30);
  }
}
