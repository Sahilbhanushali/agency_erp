import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';

export function resolveTargetCompanyId(
  requestedCompanyId: string | undefined,
  actor: CurrentUserPayload,
): string {
  if (actor.roleName === 'SUPER_ADMIN') {
    if (!requestedCompanyId)
      throw new BadRequestException('companyId is required');
    return requestedCompanyId;
  }
  if (!actor.companyId)
    throw new ForbiddenException('You are not scoped to a company');
  return actor.companyId;
}

/** Mirrors PermissionsGuard, for services that grant access by permission OR by ownership. */
export function hasPermission(
  actor: CurrentUserPayload,
  permission: string,
): boolean {
  return (
    actor.roleName === 'SUPER_ADMIN' || actor.permissions.includes(permission)
  );
}

export function assertCompanyAccess(
  companyId: string | null,
  actor: CurrentUserPayload,
) {
  if (actor.roleName === 'SUPER_ADMIN') return;
  if (actor.companyId !== companyId) {
    throw new ForbiddenException(
      'You do not have permission to access this resource',
    );
  }
}

/**
 * Which tasks an actor may see. Shared by the tasks list and the dashboard counts
 * so the two can never disagree about what is visible.
 */
export function taskScopeFilter(
  actor: CurrentUserPayload,
  requestedCompanyId?: string,
): Prisma.TaskWhereInput {
  if (actor.roleName === 'SUPER_ADMIN') {
    return requestedCompanyId ? { companyId: requestedCompanyId } : {};
  }
  if (!actor.companyId)
    throw new ForbiddenException('You are not scoped to a company');
  if (hasPermission(actor, 'tasks:read')) return { companyId: actor.companyId };

  return {
    companyId: actor.companyId,
    OR: [
      { assigneeId: actor.id },
      { createdById: actor.id },
      {
        workspace: {
          members: { some: { userId: actor.id, deletedAt: null } },
        },
      },
    ],
  };
}
