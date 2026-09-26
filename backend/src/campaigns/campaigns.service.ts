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
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

const CAMPAIGN_INCLUDE = {
  client: { select: { id: true, name: true } },
  project: { select: { id: true, title: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { posts: { where: { deletedAt: null } } } },
} as const;

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCampaignDto, actor: CurrentUserPayload) {
    const companyId = resolveTargetCompanyId(dto.companyId, actor);
    await this.assertClientInCompany(dto.clientId, companyId);
    await this.assertProjectInCompany(dto.projectId, companyId);
    assertDateOrder(dto.startDate, dto.endDate);

    return this.prisma.campaign.create({
      data: {
        companyId,
        clientId: dto.clientId,
        projectId: dto.projectId,
        createdById: actor.id,
        name: dto.name,
        description: dto.description,
        objective: dto.objective,
        status: dto.status,
        budget: dto.budget,
        currency: dto.currency,
        startDate: toDateOrUndefined(dto.startDate),
        endDate: toDateOrUndefined(dto.endDate),
      },
      include: CAMPAIGN_INCLUDE,
    });
  }

  async findAll(actor: CurrentUserPayload, filters: ListCampaignsQueryDto) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? filters.companyId : actor.companyId;
    const query = filters.search?.trim();
    const where: Prisma.CampaignWhereInput = {
      deletedAt: null,
      ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.objective ? { objective: filters.objective } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { client: { name: { contains: query } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where,
        include: CAMPAIGN_INCLUDE,
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { data, meta: buildMeta(total, filters.page, filters.limit) };
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...CAMPAIGN_INCLUDE,
        metrics: { orderBy: { periodStart: 'desc' } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    assertCompanyAccess(campaign.companyId, actor);
    return { ...campaign, performance: summarise(campaign.metrics) };
  }

  async update(id: string, dto: UpdateCampaignDto, actor: CurrentUserPayload) {
    const campaign = await this.findOne(id, actor);
    if (dto.clientId)
      await this.assertClientInCompany(dto.clientId, campaign.companyId);
    if (dto.projectId)
      await this.assertProjectInCompany(dto.projectId, campaign.companyId);

    assertDateOrder(
      dto.startDate ?? campaign.startDate?.toISOString(),
      dto.endDate ?? campaign.endDate?.toISOString(),
    );

    return this.prisma.campaign.update({
      where: { id },
      data: {
        clientId: dto.clientId,
        projectId: dto.projectId,
        name: dto.name,
        description: dto.description,
        objective: dto.objective,
        status: dto.status,
        budget: dto.budget,
        currency: dto.currency,
        startDate: toDateOrUndefined(dto.startDate),
        endDate: toDateOrUndefined(dto.endDate),
      },
      include: CAMPAIGN_INCLUDE,
    });
  }

  async remove(id: string, actor: CurrentUserPayload) {
    await this.findOne(id, actor);
    await this.prisma.campaign.update({
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

  private async assertProjectInCompany(
    projectId: string | null | undefined,
    companyId: string,
  ) {
    if (!projectId) return;
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
    });
    if (!project)
      throw new BadRequestException('Project not found in this company');
  }
}

function assertDateOrder(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) return;
  if (new Date(endDate) < new Date(startDate)) {
    throw new BadRequestException('End date cannot be before the start date');
  }
}

/**
 * Totals are summed; the ratios below are derived on read because the schema
 * deliberately stores no computed columns. Each is defined here so a number on
 * screen can always be traced back to the two figures it came from.
 */
export function summarise(
  metrics: {
    spend: Prisma.Decimal;
    impressions: number;
    clicks: number;
    leads: number;
    conversions: number;
    revenue: Prisma.Decimal;
  }[],
) {
  const totals = metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + Number(m.spend),
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      leads: acc.leads + m.leads,
      conversions: acc.conversions + m.conversions,
      revenue: acc.revenue + Number(m.revenue),
    }),
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      conversions: 0,
      revenue: 0,
    },
  );

  return {
    ...totals,
    /** clicks / impressions */
    clickThroughRate: ratio(totals.clicks, totals.impressions),
    /** spend / clicks */
    costPerClick: ratio(totals.spend, totals.clicks),
    /** spend / leads */
    costPerLead: ratio(totals.spend, totals.leads),
    /** revenue / spend */
    returnOnAdSpend: ratio(totals.revenue, totals.spend),
  };
}

/** null rather than 0, so "no data yet" is never rendered as a real result. */
function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}
