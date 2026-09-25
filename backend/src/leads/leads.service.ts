import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityEntity,
  LeadActivityType,
  LeadStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { buildMeta, toSkipTake } from '../common/utils/paginate.util';
import {
  assertCompanyAccess,
  resolveTargetCompanyId,
} from '../common/utils/tenant-scope.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConvertLeadDto,
  LogLeadActivityDto,
  ReorderLeadsDto,
} from './dto/lead-actions.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { assertStatusChange, CLOSED_STAGES, isOpen } from './lead-pipeline';

const LEAD_INCLUDE = {
  owner: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true },
  },
  convertedClient: { select: { id: true, name: true } },
  _count: { select: { activities: true } },
} as const;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateLeadDto, actor: CurrentUserPayload) {
    const companyId = resolveTargetCompanyId(dto.companyId, actor);
    if (dto.ownerId) await this.assertOwnerInCompany(dto.ownerId, companyId);

    const status = dto.status ?? LeadStatus.NEW;
    assertStatusChange(LeadStatus.NEW, status, {
      lostReason: dto.lostReason,
      isConverted: false,
    });

    const lead = await this.prisma.lead.create({
      data: {
        companyId,
        ownerId: dto.ownerId ?? actor.id,
        name: dto.name,
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        industry: dto.industry,
        estimatedValue: dto.estimatedValue,
        currency: dto.currency,
        status,
        priority: dto.priority,
        notes: dto.notes,
        nextFollowUpAt: toDateOrNull(dto.nextFollowUpAt),
        lostReason: dto.lostReason,
        closedAt: isOpen(status) ? null : new Date(),
        position: await this.nextPosition(companyId, status),
        activities: {
          create: {
            userId: actor.id,
            type: LeadActivityType.NOTE,
            note: 'Lead created',
            toValue: status,
          },
        },
      },
      include: LEAD_INCLUDE,
    });

    this.notifyOwner(lead, actor);
    return lead;
  }

  async findAll(actor: CurrentUserPayload, filters: ListLeadsQueryDto) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? filters.companyId : actor.companyId;
    const query = filters.search?.trim();
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.openOnly ? { status: { notIn: CLOSED_STAGES } } : {}),
      ...(filters.followUpDue
        ? {
            nextFollowUpAt: { lte: new Date() },
            status: { notIn: CLOSED_STAGES },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { companyName: { contains: query } },
              { email: { contains: query } },
              { phone: { contains: query } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        include: LEAD_INCLUDE,
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data, meta: buildMeta(total, filters.page, filters.limit) };
  }

  /** Pipeline totals by stage, so the board can show value per column. */
  async pipelineSummary(actor: CurrentUserPayload, companyId?: string) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? companyId : actor.companyId;
    const where: Prisma.LeadWhereInput = {
      deletedAt: null,
      ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
    };

    const grouped = await this.prisma.lead.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
      _sum: { estimatedValue: true },
    });

    return grouped.map((row) => ({
      status: row.status,
      count: row._count._all,
      value: Number(row._sum.estimatedValue ?? 0),
    }));
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...LEAD_INCLUDE,
        activities: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    assertCompanyAccess(lead.companyId, actor);
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, actor: CurrentUserPayload) {
    const lead = await this.findOne(id, actor);
    if (dto.ownerId)
      await this.assertOwnerInCompany(dto.ownerId, lead.companyId);

    const nextStatus = dto.status ?? lead.status;
    if (dto.status) {
      assertStatusChange(lead.status, dto.status, {
        lostReason: dto.lostReason ?? lead.lostReason,
        isConverted: !!lead.convertedClientId,
      });
    }

    const activities: Prisma.LeadActivityCreateWithoutLeadInput[] = [];
    if (dto.status && dto.status !== lead.status) {
      activities.push({
        user: { connect: { id: actor.id } },
        type: LeadActivityType.STATUS_CHANGED,
        fromValue: lead.status,
        toValue: dto.status,
        note: dto.status === LeadStatus.LOST ? (dto.lostReason ?? null) : null,
      });
    }
    if (dto.ownerId !== undefined && dto.ownerId !== lead.ownerId) {
      activities.push({
        user: { connect: { id: actor.id } },
        type: LeadActivityType.ASSIGNED,
        fromValue: lead.ownerId,
        toValue: dto.ownerId,
      });
    }
    if (
      dto.nextFollowUpAt !== undefined &&
      toDateOrNull(dto.nextFollowUpAt)?.getTime() !==
        lead.nextFollowUpAt?.getTime()
    ) {
      activities.push({
        user: { connect: { id: actor.id } },
        type: LeadActivityType.FOLLOW_UP_SET,
        toValue: dto.nextFollowUpAt ?? null,
      });
    }

    const updated = await this.prisma.lead.update({
      where: { id },
      data: {
        ownerId: dto.ownerId,
        name: dto.name,
        companyName: dto.companyName,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        industry: dto.industry,
        estimatedValue: dto.estimatedValue,
        currency: dto.currency,
        status: dto.status,
        priority: dto.priority,
        notes: dto.notes,
        lostReason: dto.lostReason,
        ...(dto.nextFollowUpAt !== undefined
          ? { nextFollowUpAt: toDateOrNull(dto.nextFollowUpAt) }
          : {}),
        ...(dto.status
          ? { closedAt: isOpen(nextStatus) ? null : new Date() }
          : {}),
        ...(activities.length ? { activities: { create: activities } } : {}),
      },
      include: LEAD_INCLUDE,
    });

    if (dto.ownerId && dto.ownerId !== lead.ownerId) {
      this.notifyOwner(updated, actor);
    }
    return updated;
  }

  /** Drag and drop across pipeline columns. */
  async reorder(dto: ReorderLeadsDto, actor: CurrentUserPayload) {
    const visible = await this.prisma.lead.findMany({
      where: {
        id: { in: dto.leadIds },
        deletedAt: null,
        ...this.scopeFilter(actor),
      },
      select: { id: true, status: true, convertedClientId: true },
    });
    if (visible.length !== dto.leadIds.length) {
      throw new NotFoundException('One or more leads were not found');
    }

    const moving = visible.filter((lead) => lead.status !== dto.status);
    // A board drag cannot supply a reason, so losing a deal stays a deliberate edit.
    if (dto.status === LeadStatus.LOST && moving.length > 0) {
      throw new BadRequestException(
        'Open the lead to mark it lost — a reason is required.',
      );
    }
    const converted = moving.find((lead) => lead.convertedClientId);
    if (converted) {
      throw new BadRequestException(
        'A converted lead cannot be moved back into the pipeline.',
      );
    }

    await this.prisma.$transaction([
      ...dto.leadIds.map((id, position) =>
        this.prisma.lead.update({
          where: { id },
          data: {
            position,
            status: dto.status,
            closedAt: isOpen(dto.status) ? null : new Date(),
          },
        }),
      ),
      ...moving.map((lead) =>
        this.prisma.leadActivity.create({
          data: {
            leadId: lead.id,
            userId: actor.id,
            type: LeadActivityType.STATUS_CHANGED,
            fromValue: lead.status,
            toValue: dto.status,
          },
        }),
      ),
    ]);

    return this.findAll(actor, { status: dto.status, limit: 200 });
  }

  async logActivity(
    id: string,
    dto: LogLeadActivityDto,
    actor: CurrentUserPayload,
  ) {
    await this.findOne(id, actor);
    await this.prisma.leadActivity.create({
      data: {
        leadId: id,
        userId: actor.id,
        type: dto.type,
        note: dto.note,
      },
    });
    return this.findOne(id, actor);
  }

  /**
   * Turns a won lead into a real client. The lead is kept and linked rather than
   * deleted, so the pipeline history behind a client stays readable.
   */
  async convert(id: string, dto: ConvertLeadDto, actor: CurrentUserPayload) {
    const lead = await this.findOne(id, actor);
    if (lead.convertedClientId) {
      throw new ConflictException('This lead is already a client.');
    }

    const email = dto.email?.trim() || lead.email;
    if (!email) {
      throw new BadRequestException(
        'A client needs an email address; add one to the lead first.',
      );
    }
    const name = dto.name?.trim() || lead.companyName || lead.name;

    const existing = await this.prisma.client.findFirst({
      where: { companyId: lead.companyId, email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `A client with that email already exists (${existing.name}).`,
      );
    }

    const client = await this.prisma.$transaction(async (tx) => {
      const created = await tx.client.create({
        data: {
          companyId: lead.companyId,
          name,
          email,
          phone: lead.phone,
          industry: lead.industry,
          accountManagerId: lead.ownerId,
        },
      });
      await tx.lead.update({
        where: { id },
        data: {
          status: LeadStatus.WON,
          convertedClientId: created.id,
          closedAt: new Date(),
          activities: {
            create: {
              userId: actor.id,
              type: LeadActivityType.CONVERTED,
              note: `Converted to client "${created.name}"`,
              fromValue: lead.status,
              toValue: LeadStatus.WON,
            },
          },
        },
      });
      return created;
    });

    return { lead: await this.findOne(id, actor), client };
  }

  async remove(id: string, actor: CurrentUserPayload) {
    const lead = await this.findOne(id, actor);
    if (lead.convertedClientId) {
      throw new BadRequestException(
        'This lead became a client; deleting it would lose how that client arrived.',
      );
    }
    await this.prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
  }

  private notifyOwner(
    lead: { id: string; name: string; ownerId: string | null },
    actor: CurrentUserPayload,
  ) {
    void this.notifications.notify({
      userIds: [lead.ownerId],
      actorId: actor.id,
      type: NotificationType.SYSTEM_ALERT,
      title: 'Lead assigned to you',
      body: `${actor.firstName} assigned you the lead "${lead.name}".`,
      entity: ActivityEntity.LEAD,
      entityId: lead.id,
      actionUrl: `/leads?leadId=${lead.id}`,
    });
  }

  /** Reordering must never reach across tenants, so the scope is explicit. */
  private scopeFilter(actor: CurrentUserPayload): Prisma.LeadWhereInput {
    if (actor.roleName === 'SUPER_ADMIN') return {};
    if (!actor.companyId) {
      throw new ForbiddenException('You are not scoped to a company');
    }
    return { companyId: actor.companyId };
  }

  private async nextPosition(companyId: string, status: LeadStatus) {
    const last = await this.prisma.lead.findFirst({
      where: { companyId, status, deletedAt: null },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    return (last?.position ?? -1) + 1;
  }

  private async assertOwnerInCompany(ownerId: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: ownerId, companyId, deletedAt: null },
    });
    if (!user) throw new BadRequestException('Owner not found in this company');
  }
}

function toDateOrNull(value?: string | null) {
  if (value === undefined) return undefined;
  return value ? new Date(value) : null;
}
