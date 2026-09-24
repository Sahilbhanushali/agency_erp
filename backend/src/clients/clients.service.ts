import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import {
  buildMeta,
  searchFilter,
  toSkipTake,
} from '../common/utils/paginate.util';
import {
  assertCompanyAccess,
  resolveTargetCompanyId,
} from '../common/utils/tenant-scope.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClientDto, actor: CurrentUserPayload) {
    const companyId = resolveTargetCompanyId(dto.companyId, actor);
    await this.assertAccountManagerInCompany(dto.accountManagerId, companyId);

    return this.prisma.client.create({
      data: {
        companyId,
        name: dto.name,
        email: dto.email,
        industry: dto.industry,
        website: dto.website,
        logoUrl: dto.logoUrl,
        phone: dto.phone,
        gstNumber: dto.gstNumber,
        panNumber: dto.panNumber,
        accountManagerId: dto.accountManagerId,
        note: dto.note,
      },
    });
  }

  async findAll(actor: CurrentUserPayload, filters: ListClientsQueryDto) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? filters.companyId : actor.companyId;
    const where: Prisma.ClientWhereInput = {
      deletedAt: null,
      ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      ...searchFilter(filters.search, ['name', 'email', 'industry']),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data, meta: buildMeta(total, filters.page, filters.limit) };
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const client = await this.prisma.client.findFirst({
      where: { id, deletedAt: null },
    });
    if (!client) throw new NotFoundException('Client not found');
    assertCompanyAccess(client.companyId, actor);
    return client;
  }

  async update(id: string, dto: UpdateClientDto, actor: CurrentUserPayload) {
    const client = await this.findOne(id, actor);
    if (dto.accountManagerId)
      await this.assertAccountManagerInCompany(
        dto.accountManagerId,
        client.companyId,
      );

    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string, actor: CurrentUserPayload) {
    await this.findOne(id, actor);
    await this.prisma.client.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id, isActive: false },
    });
  }

  private async assertAccountManagerInCompany(
    accountManagerId: string | undefined,
    companyId: string,
  ) {
    if (!accountManagerId) return;
    const manager = await this.prisma.user.findFirst({
      where: { id: accountManagerId, companyId, deletedAt: null },
    });
    if (!manager)
      throw new BadRequestException(
        'Account manager not found in this company',
      );
  }
}
