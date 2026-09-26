import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityEntity,
  ApprovalDecisionType,
  ApprovalStatus,
  NotificationType,
  PostStatus,
  PostTimelineAction,
  Prisma,
} from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { buildMeta, toSkipTake } from '../common/utils/paginate.util';
import {
  assertCompanyAccess,
  hasPermission,
} from '../common/utils/tenant-scope.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { isResolved, isVerdict, outcomeOf } from './approval-workflow';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { DecideApprovalDto } from './dto/decide-approval.dto';
import { ListApprovalsQueryDto } from './dto/list-approvals-query.dto';

const REQUEST_INCLUDE = {
  requestedBy: { select: { id: true, firstName: true, lastName: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  clientPortalUser: { select: { id: true, name: true, email: true } },
  decisions: {
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      clientPortalUser: { select: { id: true, name: true } },
    },
  },
} as const;

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateApprovalDto, actor: CurrentUserPayload) {
    if (!dto.assignedToId && !dto.clientPortalUserId) {
      throw new BadRequestException(
        'An approval needs a reviewer: either a team member or a client portal user.',
      );
    }
    if (dto.assignedToId && dto.clientPortalUserId) {
      throw new BadRequestException(
        'An approval has one reviewer, not both a team member and a client.',
      );
    }

    const companyId = await this.assertEntityInCompany(
      dto.entity,
      dto.entityId,
      actor,
    );
    if (dto.assignedToId) {
      await this.assertReviewerInCompany(dto.assignedToId, companyId);
    }

    const duplicate = await this.prisma.approvalRequest.findFirst({
      where: {
        entity: dto.entity,
        entityId: dto.entityId,
        status: ApprovalStatus.PENDING,
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        'That record already has an approval waiting on a decision.',
      );
    }

    const request = await this.prisma.approvalRequest.create({
      data: {
        companyId,
        entity: dto.entity,
        entityId: dto.entityId,
        requestedById: actor.id,
        assignedToId: dto.assignedToId,
        clientPortalUserId: dto.clientPortalUserId,
        title: dto.title,
        note: dto.note,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      },
      include: REQUEST_INCLUDE,
    });

    if (dto.assignedToId) {
      void this.notifications.notify({
        userIds: [dto.assignedToId],
        actorId: actor.id,
        type: NotificationType.CLIENT_APPROVAL_REQUIRED,
        title: 'Approval requested',
        body: `${actor.firstName} asked you to review "${dto.title}".`,
        entity: dto.entity,
        entityId: dto.entityId,
        actionUrl: '/approvals',
      });
    }

    return request;
  }

  async findAll(actor: CurrentUserPayload, filters: ListApprovalsQueryDto) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? filters.companyId : actor.companyId;
    const where: Prisma.ApprovalRequestWhereInput = {
      ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      ...(filters.entity ? { entity: filters.entity } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assignedToId ? { assignedToId: filters.assignedToId } : {}),
      ...(filters.mine
        ? { assignedToId: actor.id, status: ApprovalStatus.PENDING }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.approvalRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        // Oldest pending first: the thing waiting longest is the thing to do next.
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    return { data, meta: buildMeta(total, filters.page, filters.limit) };
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id },
      include: REQUEST_INCLUDE,
    });
    if (!request) throw new NotFoundException('Approval not found');
    assertCompanyAccess(request.companyId, actor);
    return request;
  }

  /**
   * Records a decision and, for entities that have a workflow, moves the record
   * itself. The decision log is append-only; a resolved request accepts further
   * comments but never a second verdict, so an outcome cannot be overwritten.
   */
  async decide(id: string, dto: DecideApprovalDto, actor: CurrentUserPayload) {
    const request = await this.findOne(id, actor);
    this.assertCanDecide(request, actor);

    if (isVerdict(dto.decision) && isResolved(request.status)) {
      throw new BadRequestException(
        `This approval was already ${request.status.toLowerCase().replace('_', ' ')}. Add a comment instead, or raise a new approval.`,
      );
    }
    if (
      dto.decision === ApprovalDecisionType.REQUEST_CHANGES &&
      !dto.comment?.trim()
    ) {
      throw new BadRequestException(
        'Say what needs changing, so the request is actionable.',
      );
    }

    const outcome = outcomeOf(dto.decision);

    await this.prisma.$transaction([
      this.prisma.approvalDecision.create({
        data: {
          approvalRequestId: id,
          userId: actor.id,
          decision: dto.decision,
          comment: dto.comment,
        },
      }),
      ...(outcome
        ? [
            this.prisma.approvalRequest.update({
              where: { id },
              data: { status: outcome, resolvedAt: new Date() },
            }),
          ]
        : []),
    ]);

    if (outcome) {
      await this.applyToEntity(
        request.entity,
        request.entityId,
        outcome,
        actor,
      );
      void this.notifications.notify({
        userIds: [request.requestedById],
        actorId: actor.id,
        type: NotificationType.CLIENT_APPROVAL_REQUIRED,
        title: `Approval ${outcome.toLowerCase().replace('_', ' ')}`,
        body: `${actor.firstName} ${verbFor(dto.decision)} "${request.title}".`,
        entity: request.entity,
        entityId: request.entityId,
        actionUrl: '/approvals',
      });
    }

    return this.findOne(id, actor);
  }

  /** Only the person who asked can withdraw the question. */
  async cancel(id: string, actor: CurrentUserPayload) {
    const request = await this.findOne(id, actor);
    if (isResolved(request.status)) {
      throw new BadRequestException(
        'A decided approval cannot be cancelled; its record stands.',
      );
    }
    if (
      request.requestedById !== actor.id &&
      !hasPermission(actor, 'approvals:update')
    ) {
      throw new ForbiddenException(
        'Only the requester can cancel this approval.',
      );
    }

    await this.prisma.approvalRequest.update({
      where: { id },
      data: { status: ApprovalStatus.CANCELLED, resolvedAt: new Date() },
    });
    return this.findOne(id, actor);
  }

  /**
   * The seam where a verdict drives the record's own status. Only content has a
   * production workflow today; other entities keep their existing approval columns
   * and simply carry the decision trail, until they grow one.
   */
  private async applyToEntity(
    entity: ActivityEntity,
    entityId: string,
    outcome: ApprovalStatus,
    actor: CurrentUserPayload,
  ) {
    if (entity !== ActivityEntity.POST) return;

    const nextStatus =
      outcome === ApprovalStatus.APPROVED
        ? PostStatus.APPROVED
        : outcome === ApprovalStatus.CHANGES_REQUESTED ||
            outcome === ApprovalStatus.REJECTED
          ? PostStatus.NEEDS_REVISION
          : null;
    if (!nextStatus) return;

    const post = await this.prisma.post.findFirst({
      where: { id: entityId, deletedAt: null },
      select: { id: true, status: true },
    });
    // Only content actually under review is moved by a verdict.
    if (!post || post.status !== PostStatus.IN_REVIEW) return;

    await this.prisma.$transaction([
      this.prisma.post.update({
        where: { id: post.id },
        data: { status: nextStatus },
      }),
      this.prisma.postTimelineActivity.create({
        data: {
          postId: post.id,
          userId: actor.id,
          action:
            nextStatus === PostStatus.APPROVED
              ? PostTimelineAction.APPROVED
              : PostTimelineAction.REJECTED,
          fromValue: post.status,
          toValue: nextStatus,
          note: 'via approval',
        },
      }),
    ]);
  }

  /** The assigned reviewer decides; approvals:update covers standing in for them. */
  private assertCanDecide(
    request: { assignedToId: string | null; clientPortalUserId: string | null },
    actor: CurrentUserPayload,
  ) {
    if (request.clientPortalUserId) {
      throw new ForbiddenException(
        'This approval is assigned to a client and is decided from the client portal.',
      );
    }
    if (
      request.assignedToId !== actor.id &&
      !hasPermission(actor, 'approvals:update')
    ) {
      throw new ForbiddenException(
        'This approval is assigned to someone else.',
      );
    }
  }

  /** Resolves the entity's company, which also proves the actor may see it. */
  private async assertEntityInCompany(
    entity: ActivityEntity,
    entityId: string,
    actor: CurrentUserPayload,
  ): Promise<string> {
    const owner = await this.findEntityCompany(entity, entityId);
    if (!owner) {
      throw new BadRequestException(
        `No ${entity.toLowerCase()} found with that id.`,
      );
    }
    assertCompanyAccess(owner, actor);
    return owner;
  }

  private async findEntityCompany(
    entity: ActivityEntity,
    entityId: string,
  ): Promise<string | null> {
    const where = { id: entityId, deletedAt: null };
    const select = { companyId: true };

    switch (entity) {
      case ActivityEntity.POST:
        return (
          (await this.prisma.post.findFirst({ where, select }))?.companyId ??
          null
        );
      case ActivityEntity.CAMPAIGN:
        return (
          (await this.prisma.campaign.findFirst({ where, select }))
            ?.companyId ?? null
        );
      case ActivityEntity.QUOTATION:
        return (
          (await this.prisma.quotation.findFirst({ where, select }))
            ?.companyId ?? null
        );
      case ActivityEntity.INVOICE:
        return (
          (await this.prisma.invoice.findFirst({ where, select }))?.companyId ??
          null
        );
      case ActivityEntity.EXPENSE:
        return (
          (await this.prisma.expense.findFirst({ where, select }))?.companyId ??
          null
        );
      case ActivityEntity.PROJECT:
        return (
          (await this.prisma.project.findFirst({ where, select }))?.companyId ??
          null
        );
      case ActivityEntity.DOCUMENT:
        return (
          (await this.prisma.document.findFirst({ where, select }))
            ?.companyId ?? null
        );
      default:
        throw new BadRequestException(
          `${entity} cannot be put through approval yet.`,
        );
    }
  }

  private async assertReviewerInCompany(userId: string, companyId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
    });
    if (!user)
      throw new BadRequestException('Reviewer not found in this company');
  }
}

function verbFor(decision: ApprovalDecisionType) {
  if (decision === ApprovalDecisionType.APPROVE) return 'approved';
  if (decision === ApprovalDecisionType.REJECT) return 'rejected';
  return 'requested changes on';
}
