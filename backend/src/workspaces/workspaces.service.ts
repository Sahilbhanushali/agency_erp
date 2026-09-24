import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, WorkspaceMemberRole } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import {
  buildMeta,
  searchFilter,
  toSkipTake,
} from '../common/utils/paginate.util';
import { assertCompanyAccess } from '../common/utils/tenant-scope.util';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { ListWorkspacesQueryDto } from './dto/list-workspaces-query.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

const MEMBER_INCLUDE = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      // The member's company role, so a board can show who is a manager, designer, etc.
      role: { select: { id: true, name: true, displayName: true } },
    },
  },
} as const;

const WORKSPACE_INCLUDE = {
  members: {
    where: { deletedAt: null },
    include: MEMBER_INCLUDE,
  },
} as const;

@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkspaceDto, actor: CurrentUserPayload) {
    const project = await this.prisma.project.findFirst({
      where: { id: dto.projectId, deletedAt: null },
    });
    if (!project) throw new BadRequestException('Project not found');
    assertCompanyAccess(project.companyId, actor);

    return this.prisma.workspace.create({
      data: {
        companyId: project.companyId,
        projectId: dto.projectId,
        name: dto.name,
        description: dto.description,
        colorHex: dto.colorHex,
      },
      include: WORKSPACE_INCLUDE,
    });
  }

  async findAll(actor: CurrentUserPayload, filters: ListWorkspacesQueryDto) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? filters.companyId : actor.companyId;
    const where: Prisma.WorkspaceWhereInput = {
      deletedAt: null,
      ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...searchFilter(filters.search, ['name']),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.workspace.findMany({
        where,
        include: WORKSPACE_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.workspace.count({ where }),
    ]);

    return { data, meta: buildMeta(total, filters.page, filters.limit) };
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { id, deletedAt: null },
      include: WORKSPACE_INCLUDE,
    });
    if (!workspace) throw new NotFoundException('Workspace not found');
    assertCompanyAccess(workspace.companyId, actor);
    return workspace;
  }

  async update(id: string, dto: UpdateWorkspaceDto, actor: CurrentUserPayload) {
    await this.findOne(id, actor);
    return this.prisma.workspace.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        colorHex: dto.colorHex,
        isActive: dto.isActive,
      },
      include: WORKSPACE_INCLUDE,
    });
  }

  async remove(id: string, actor: CurrentUserPayload) {
    await this.findOne(id, actor);
    await this.prisma.workspace.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id, isActive: false },
    });
  }

  async addMember(
    workspaceId: string,
    dto: AddMemberDto,
    actor: CurrentUserPayload,
  ) {
    const workspace = await this.findOne(workspaceId, actor);

    const user = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        companyId: workspace.companyId,
        deletedAt: null,
      },
    });
    if (!user) throw new BadRequestException('User not found in this company');

    const existing = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: dto.userId } },
    });

    if (existing && !existing.deletedAt) {
      throw new BadRequestException(
        'User is already a member of this workspace',
      );
    }

    if (existing) {
      return this.prisma.workspaceMember.update({
        where: { id: existing.id },
        data: {
          // Re-adding someone is a fresh membership, so an omitted role resets to the
          // default rather than silently inheriting the role they had before removal.
          memberRole: dto.memberRole ?? WorkspaceMemberRole.MEMBER,
          addedById: actor.id,
          deletedAt: null,
          deletedBy: null,
        },
        include: MEMBER_INCLUDE,
      });
    }

    return this.prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: dto.userId,
        addedById: actor.id,
        memberRole: dto.memberRole,
      },
      include: MEMBER_INCLUDE,
    });
  }

  async removeMember(
    workspaceId: string,
    userId: string,
    actor: CurrentUserPayload,
  ) {
    await this.findOne(workspaceId, actor);

    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, deletedAt: null },
    });
    if (!member) throw new NotFoundException('Workspace member not found');

    await this.prisma.workspaceMember.update({
      where: { id: member.id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
  }
}
