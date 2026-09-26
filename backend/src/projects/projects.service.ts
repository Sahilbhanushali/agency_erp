import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { toDateOrUndefined } from '../common/utils/date.util';
import { buildMeta, toSkipTake } from '../common/utils/paginate.util';
import {
  assertCompanyAccess,
  resolveTargetCompanyId,
} from '../common/utils/tenant-scope.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const PROJECT_INCLUDE = {
  client: { select: { id: true, name: true } },
  manager: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
} as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectDto, actor: CurrentUserPayload) {
    const companyId = resolveTargetCompanyId(dto.companyId, actor);
    await this.assertClientInCompany(dto.clientId, companyId);
    await this.assertManagerInCompany(dto.managerId, companyId);

    return this.prisma.project.create({
      data: {
        companyId,
        clientId: dto.clientId,
        managerId: dto.managerId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        startDate: toDateOrUndefined(dto.startDate),
        deadline: toDateOrUndefined(dto.deadline),
        budget: dto.budget,
        currency: dto.currency,
        clientApprovalEnabled: dto.clientApprovalEnabled,
        colorHex: dto.colorHex,
      },
      include: PROJECT_INCLUDE,
    });
  }

  async findAll(actor: CurrentUserPayload, filters: ListProjectsQueryDto) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? filters.companyId : actor.companyId;
    const query = filters.search?.trim();
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { client: { name: { contains: query } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: PROJECT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.project.count({ where }),
    ]);

    return { data, meta: buildMeta(total, filters.page, filters.limit) };
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const project = await this.prisma.project.findFirst({
      where: { id, deletedAt: null },
      include: PROJECT_INCLUDE,
    });
    if (!project) throw new NotFoundException('Project not found');
    assertCompanyAccess(project.companyId, actor);
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, actor: CurrentUserPayload) {
    const project = await this.findOne(id, actor);
    if (dto.clientId)
      await this.assertClientInCompany(dto.clientId, project.companyId);
    if (dto.managerId)
      await this.assertManagerInCompany(dto.managerId, project.companyId);

    return this.prisma.project.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        managerId: dto.managerId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        startDate: toDateOrUndefined(dto.startDate),
        deadline: toDateOrUndefined(dto.deadline),
        budget: dto.budget,
        currency: dto.currency,
        clientApprovalEnabled: dto.clientApprovalEnabled,
        colorHex: dto.colorHex,
      },
      include: PROJECT_INCLUDE,
    });
  }

  async remove(id: string, actor: CurrentUserPayload) {
    await this.findOne(id, actor);
    await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
  }

  private async assertClientInCompany(clientId: string, companyId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, deletedAt: null },
    });
    if (!client)
      throw new BadRequestException('Client not found in this company');
  }

  private async assertManagerInCompany(managerId: string, companyId: string) {
    const manager = await this.prisma.user.findFirst({
      where: { id: managerId, companyId, deletedAt: null },
    });
    if (!manager)
      throw new BadRequestException('Manager not found in this company');
  }
}
