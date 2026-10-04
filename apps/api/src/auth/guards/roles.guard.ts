import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import {
  hasAnyRole,
  hasPermission,
  resolveRoles,
  type Permission,
  type Role,
} from '../rbac/roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    // No metadata → allow (JwtAuthGuard still applies if used)
    if (!requiredRoles.length && !requiredPermissions.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { isAdmin?: boolean; roles?: string[]; adminRoles?: string[] }
      | undefined;

    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Authentication required',
      });
    }

    const roles = resolveRoles({
      isAdmin: user.isAdmin,
      adminRoles: (user.roles || user.adminRoles || []) as string[],
    });

    if (requiredRoles.length && !hasAnyRole(roles, requiredRoles)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `Requires role: ${requiredRoles.join(' | ')}`,
      });
    }

    for (const perm of requiredPermissions) {
      if (!hasPermission(roles, perm)) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: `Missing permission: ${perm}`,
        });
      }
    }

    // Attach resolved roles for downstream handlers
    request.user = { ...user, roles };
    return true;
  }
}
