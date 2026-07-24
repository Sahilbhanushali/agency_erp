import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user: CurrentUserPayload }>();
    if (!user)
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );

    // SUPER_ADMIN is a platform-level superuser and bypasses granular permission checks.
    if (user.roleName === 'SUPER_ADMIN') return true;

    const hasAllPermissions = requiredPermissions.every((permission) =>
      user.permissions.includes(permission),
    );
    if (!hasAllPermissions) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
