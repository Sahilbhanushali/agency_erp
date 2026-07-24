import { Injectable } from '@nestjs/common';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(actor: CurrentUserPayload, companyId?: string) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? companyId : actor.companyId;
    return this.prisma.role.findMany({
      where: {
        deletedAt: null,
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      },
      select: { id: true, companyId: true, name: true, displayName: true },
      orderBy: { displayName: 'asc' },
    });
  }
}
