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
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @RequirePermissions('dashboard:read')
  @ApiOperation({ summary: 'Dashboard (dashboard:read)' })
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('health')
  @RequirePermissions('system:read')
  health() {
    return this.adminService.systemHealth();
  }

  @Get('roles')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'List roles & permissions matrix' })
  roles() {
    return this.adminService.listRoles();
  }

  @Get('users')
  @RequirePermissions('users:read')
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
  @RequirePermissions('users:create')
  createUser(
    @Body()
    body: {
      fullName: string;
      phone: string;
      password: string;
      isAdmin?: boolean;
      roles?: string[];
      status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
      initialBalance?: number;
    },
  ) {
    return this.adminService.createUser(body);
  }

  @Get('users/:id')
  @RequirePermissions('users:read')
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Put('users/:id')
  @RequirePermissions('users:update')
  updateUser(
    @Param('id') id: string,
    @Body()
    body: {
      fullName?: string;
      phone?: string;
      status?: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
      isAdmin?: boolean;
      roles?: string[];
      password?: string;
      country?: string;
    },
  ) {
    return this.adminService.updateUser(id, body);
  }

  @Delete('users/:id')
  @RequirePermissions('users:delete')
  deleteUser(@Param('id') id: string, @Query('hard') hard?: string) {
    const isHard = hard === 'true' || hard === '1';
    return this.adminService.deleteUser(id, isHard);
  }

  @Patch('users/:id/status')
  @RequirePermissions('users:update')
  setStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' },
  ) {
    return this.adminService.setUserStatus(id, body.status);
  }

  @Patch('users/:id/admin')
  @RequirePermissions('users:set_role')
  setAdmin(@Param('id') id: string, @Body() body: { isAdmin: boolean; roles?: string[] }) {
    return this.adminService.setUserAdmin(id, !!body.isAdmin, body.roles);
  }

  @Patch('users/:id/roles')
  @RequirePermissions('users:set_role')
  @ApiOperation({ summary: 'Assign roles (users:set_role)' })
  setRoles(@Param('id') id: string, @Body() body: { roles: string[] }) {
    return this.adminService.setUserRoles(id, body.roles || []);
  }

  @Post('users/:id/credit')
  @RequirePermissions('users:credit')
  credit(
    @Param('id') id: string,
    @Body() body: { amount: number; note?: string },
  ) {
    return this.adminService.creditUser(id, Number(body.amount), body.note);
  }

  @Get('audit')
  @RequirePermissions('audit:read')
  audit(@Query('page') page = 1, @Query('limit') limit = 30) {
    return this.adminService.listAudit(Number(page) || 1, Number(limit) || 30);
  }
}
