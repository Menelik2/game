import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { resolveRoles, hasPermission } from '../../auth/rbac/roles';

/**
 * Baseline admin gate: any staff role with dashboard:read
 * (SUPER_ADMIN | ADMIN | MODERATOR | SUPPORT).
 * Use @RequirePermissions for finer control on endpoints.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as
      | { isAdmin?: boolean; roles?: string[]; adminRoles?: string[] }
      | undefined;

    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Admin access required',
      });
    }

    const roles = resolveRoles({
      isAdmin: user.isAdmin,
      adminRoles: (user.roles || user.adminRoles || []) as string[],
    });

    const staff = roles.some((r) => r !== 'USER');
    if (!staff && !hasPermission(roles, 'dashboard:read')) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Admin access required',
      });
    }

    request.user = { ...user, roles };
    return true;
  }
}
