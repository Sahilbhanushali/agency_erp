import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import {
  assertCompanyAccess,
  resolveTargetCompanyId,
} from '../common/utils/tenant-scope.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

const ROLE_DETAIL_INCLUDE = {
  permissions: { include: { permission: true } },
  _count: { select: { users: { where: { deletedAt: null } } } },
} as const;

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
      include: ROLE_DETAIL_INCLUDE,
      orderBy: { displayName: 'asc' },
    });
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: ROLE_DETAIL_INCLUDE,
    });
    if (!role) throw new NotFoundException('Role not found');
    assertCompanyAccess(role.companyId, actor);
    return role;
  }

  private async assertPermissionIdsExist(permissionIds: string[]) {
    if (permissionIds.length === 0) return;
    const count = await this.prisma.permission.count({
      where: { id: { in: permissionIds } },
    });
    if (count !== permissionIds.length) {
      throw new BadRequestException('One or more permissions were not found');
    }
  }

  async create(dto: CreateRoleDto, actor: CurrentUserPayload) {
    const companyId = resolveTargetCompanyId(dto.companyId, actor);
    await this.assertPermissionIdsExist(dto.permissionIds);

    const existing = await this.prisma.role.findFirst({
      where: { companyId, name: dto.name, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('A role with this name already exists');
    }

    return this.prisma.role.create({
      data: {
        companyId,
        name: dto.name,
        displayName: dto.displayName,
        description: dto.description,
        permissions: {
          create: dto.permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: ROLE_DETAIL_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateRoleDto, actor: CurrentUserPayload) {
    const role = await this.findOne(id, actor);
    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be modified');
    }
    if (dto.permissionIds) {
      await this.assertPermissionIdsExist(dto.permissionIds);
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
      }
      return tx.role.update({
        where: { id },
        data: {
          displayName: dto.displayName,
          description: dto.description,
          ...(dto.permissionIds && {
            permissions: {
              create: dto.permissionIds.map((permissionId) => ({
                permissionId,
              })),
            },
          }),
        },
        include: ROLE_DETAIL_INCLUDE,
      });
    });
  }

  async remove(id: string, actor: CurrentUserPayload) {
    const role = await this.findOne(id, actor);
    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted');
    }
    if (role._count.users > 0) {
      throw new BadRequestException(
        'This role is assigned to one or more users and cannot be deleted',
      );
    }
    await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
  }
}
