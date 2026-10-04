import {
  Controller,
  Get,
  Patch,
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

  @Get('users')
  @ApiOperation({ summary: 'List users' })
  listUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('q') q?: string,
  ) {
    return this.adminService.listUsers(Number(page) || 1, Number(limit) || 20, q);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Set user status ACTIVE | SUSPENDED | CLOSED' })
  setStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' },
  ) {
    return this.adminService.setUserStatus(id, body.status);
  }

  @Patch('users/:id/admin')
  @ApiOperation({ summary: 'Grant or revoke admin' })
  setAdmin(@Param('id') id: string, @Body() body: { isAdmin: boolean }) {
    return this.adminService.setUserAdmin(id, !!body.isAdmin);
  }
}
