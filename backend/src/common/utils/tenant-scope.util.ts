import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
