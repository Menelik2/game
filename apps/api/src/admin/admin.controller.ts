import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Delete,
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
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('health')
  health() {
    return this.adminService.systemHealth();
  }

  // ——— Users CRUD ———

  @Get('users')
  @ApiOperation({ summary: 'List users (Read)' })
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

  @Post('users')
  @ApiOperation({ summary: 'Create user' })
  createUser(
    @Body()
    body: {
      fullName: string;
      phone: string;
      password: string;
      isAdmin?: boolean;
      status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
      initialBalance?: number;
    },
  ) {
    return this.adminService.createUser(body);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user' })
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user' })
  updateUser(
    @Param('id') id: string,
    @Body()
    body: {
      fullName?: string;
      phone?: string;
      status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
      isAdmin?: boolean;
      password?: string;
      country?: string;
    },
  ) {
    return this.adminService.updateUser(id, body);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user (soft close; ?hard=true permanent)' })
  deleteUser(@Param('id') id: string, @Query('hard') hard?: string) {
    return this.adminService.deleteUser(id, hard === 'true' || hard === '1');
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
  credit(
    @Param('id') id: string,
    @Body() body: { amount: number; note?: string },
  ) {
    return this.adminService.creditUser(id, Number(body.amount), body.note);
  }

  @Get('audit')
  audit(@Query('page') page = 1, @Query('limit') limit = 30) {
    return this.adminService.listAudit(Number(page) || 1, Number(limit) || 30);
  }
}
