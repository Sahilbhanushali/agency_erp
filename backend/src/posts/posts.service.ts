import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityEntity,
  NotificationType,
  PostStatus,
  PostTimelineAction,
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
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { AddPostReferenceDto } from './dto/post-reference.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { assertTransition, POST_TRANSITIONS } from './post-workflow';

const USER_SELECT = {
  select: { id: true, firstName: true, lastName: true, avatarUrl: true },
} as const;

const POST_INCLUDE = {
  client: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
  project: { select: { id: true, title: true } },
  workspace: { select: { id: true, name: true, colorHex: true } },
  assignee: USER_SELECT,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { media: true, references: true } },
} as const;

/** Content may only be raised as an idea or a draft; everything later is a transition. */
const INITIAL_STATUSES: PostStatus[] = [PostStatus.IDEA, PostStatus.DRAFT];

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreatePostDto, actor: CurrentUserPayload) {
    const companyId = resolveTargetCompanyId(dto.companyId, actor);
    await this.assertClientInCompany(dto.clientId, companyId);
    await this.assertCampaignMatchesClient(dto.campaignId, dto.clientId);
    await this.assertProjectInCompany(dto.projectId, companyId);
    await this.assertWorkspaceInCompany(dto.workspaceId, companyId);
    await this.assertAssigneeInCompany(dto.assigneeId, companyId);

    const status = dto.status ?? PostStatus.IDEA;
    if (!INITIAL_STATUSES.includes(status)) {
      throw new BadRequestException(
        `New content starts at ${INITIAL_STATUSES.join(' or ')}, then moves through the workflow.`,
      );
    }

    const post = await this.prisma.post.create({
      data: {
        companyId,
        clientId: dto.clientId,
        campaignId: dto.campaignId,
        projectId: dto.projectId,
        workspaceId: dto.workspaceId,
        createdById: actor.id,
        assigneeId: dto.assigneeId,
        title: dto.title,
        caption: dto.caption,
        postType: dto.postType,
        deliverableType: dto.deliverableType,
        status,
        scheduledDate: toDateOrNull(dto.scheduledDate),
        timeline: {
          create: {
            userId: actor.id,
            action: PostTimelineAction.CREATED,
            toValue: status,
          },
        },
      },
      include: POST_INCLUDE,
    });

    if (post.assigneeId) this.notifyAssigned(post, actor);
    return post;
  }

  async findAll(actor: CurrentUserPayload, filters: ListPostsQueryDto) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? filters.companyId : actor.companyId;
    const query = filters.search?.trim();
    const where: Prisma.PostWhereInput = {
      deletedAt: null,
      ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.postType ? { postType: filters.postType } : {}),
      ...(filters.unscheduled ? { scheduledDate: null } : {}),
      ...(!filters.unscheduled && (filters.scheduledFrom || filters.scheduledTo)
        ? {
            scheduledDate: {
              ...(filters.scheduledFrom
                ? { gte: new Date(filters.scheduledFrom) }
                : {}),
              ...(filters.scheduledTo
                ? { lte: endOfDay(filters.scheduledTo) }
                : {}),
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { caption: { contains: query } },
              { client: { name: { contains: query } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        include: POST_INCLUDE,
        // Scheduled content first so a calendar reads in the order it will go out.
        orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.post.count({ where }),
    ]);

    return { data, meta: buildMeta(total, filters.page, filters.limit) };
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const post = await this.prisma.post.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...POST_INCLUDE,
        references: { orderBy: { position: 'asc' } },
        media: { orderBy: { position: 'asc' }, include: { file: true } },
        timeline: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    assertCompanyAccess(post.companyId, actor);

    return { ...post, allowedTransitions: POST_TRANSITIONS[post.status] };
  }

  async update(id: string, dto: UpdatePostDto, actor: CurrentUserPayload) {
    const post = await this.findOne(id, actor);

    await this.assertCampaignMatchesClient(dto.campaignId, post.clientId);
    await this.assertProjectInCompany(dto.projectId, post.companyId);
    await this.assertWorkspaceInCompany(dto.workspaceId, post.companyId);
    await this.assertAssigneeInCompany(dto.assigneeId, post.companyId);

    const nextStatus = dto.status ?? post.status;
    if (dto.status) assertTransition(post.status, dto.status);

    const scheduledDate =
      dto.scheduledDate !== undefined
        ? toDateOrNull(dto.scheduledDate)
        : post.scheduledDate;
    if (nextStatus === PostStatus.SCHEDULED && !scheduledDate) {
      throw new BadRequestException(
        'Set a scheduled date before moving content to SCHEDULED.',
      );
    }

    const timeline: Prisma.PostTimelineActivityCreateWithoutPostInput[] = [];
    if (dto.status && dto.status !== post.status) {
      timeline.push({
        user: { connect: { id: actor.id } },
        action: statusAction(dto.status),
        fromValue: post.status,
        toValue: dto.status,
      });
    }
    if (dto.assigneeId !== undefined && dto.assigneeId !== post.assigneeId) {
      timeline.push({
        user: { connect: { id: actor.id } },
        action: dto.assigneeId
          ? PostTimelineAction.ASSIGNED
          : PostTimelineAction.UNASSIGNED,
        fromValue: post.assigneeId,
        toValue: dto.assigneeId,
      });
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        campaignId: dto.campaignId,
        projectId: dto.projectId,
        workspaceId: dto.workspaceId,
        assigneeId: dto.assigneeId,
        title: dto.title,
        caption: dto.caption,
        postType: dto.postType,
        deliverableType: dto.deliverableType,
        status: dto.status,
        ...(dto.scheduledDate !== undefined
          ? { scheduledDate: toDateOrNull(dto.scheduledDate) }
          : {}),
        // Written with the change, so the trail cannot drift from the record.
        ...(timeline.length ? { timeline: { create: timeline } } : {}),
      },
      include: POST_INCLUDE,
    });

    if (dto.assigneeId && dto.assigneeId !== post.assigneeId) {
      this.notifyAssigned(updated, actor);
    }
    if (dto.status && dto.status !== post.status) {
      void this.notifications.notify({
        userIds: [updated.assigneeId, updated.createdById],
        actorId: actor.id,
        type: NotificationType.POST_STATUS_CHANGED,
        title: 'Content status changed',
        body: `${actor.firstName} moved "${updated.title}" from ${human(post.status)} to ${human(dto.status)}.`,
        entity: ActivityEntity.POST,
        entityId: updated.id,
        actionUrl: `/content?postId=${updated.id}`,
      });
    }

    return updated;
  }

  async remove(id: string, actor: CurrentUserPayload) {
    await this.findOne(id, actor);
    await this.prisma.post.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
  }

  async addReference(
    id: string,
    dto: AddPostReferenceDto,
    actor: CurrentUserPayload,
  ) {
    const post = await this.findOne(id, actor);
    const position = post.references.length;

    await this.prisma.postReference.create({
      data: {
        postId: id,
        url: dto.url,
        title: dto.title,
        note: dto.note,
        position,
      },
    });
    await this.prisma.postTimelineActivity.create({
      data: {
        postId: id,
        userId: actor.id,
        action: PostTimelineAction.REFERENCE_ADDED,
        toValue: dto.title ?? dto.url,
      },
    });

    return this.findOne(id, actor);
  }

  async removeReference(
    id: string,
    referenceId: string,
    actor: CurrentUserPayload,
  ) {
    await this.findOne(id, actor);
    const { count } = await this.prisma.postReference.deleteMany({
      where: { id: referenceId, postId: id },
    });
    if (count === 0) throw new NotFoundException('Reference not found');
  }

  private notifyAssigned(
    post: { id: string; title: string; assigneeId: string | null },
    actor: CurrentUserPayload,
  ) {
    void this.notifications.notify({
      userIds: [post.assigneeId],
      actorId: actor.id,
      type: NotificationType.POST_ASSIGNED,
      title: 'Content assigned to you',
      body: `${actor.firstName} assigned you "${post.title}".`,
      entity: ActivityEntity.POST,
      entityId: post.id,
      actionUrl: `/content?postId=${post.id}`,
    });
  }

  private async assertClientInCompany(clientId: string, companyId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, deletedAt: null },
    });
    if (!client)
      throw new BadRequestException('Client not found in this company');
  }

  /** Content and its campaign must serve the same client, or reporting silently misattributes. */
  private async assertCampaignMatchesClient(
    campaignId: string | null | undefined,
    clientId: string,
  ) {
    if (!campaignId) return;
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, clientId, deletedAt: null },
    });
    if (!campaign)
      throw new BadRequestException('Campaign not found for this client');
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

  private async assertWorkspaceInCompany(
    workspaceId: string | null | undefined,
    companyId: string,
  ) {
    if (!workspaceId) return;
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, companyId, deletedAt: null },
    });
    if (!workspace)
      throw new BadRequestException('Workspace not found in this company');
  }

  private async assertAssigneeInCompany(
    assigneeId: string | null | undefined,
    companyId: string,
  ) {
    if (!assigneeId) return;
    const user = await this.prisma.user.findFirst({
      where: { id: assigneeId, companyId, deletedAt: null },
    });
    if (!user)
      throw new BadRequestException('Assignee not found in this company');
  }
}

function statusAction(status: PostStatus): PostTimelineAction {
  if (status === PostStatus.APPROVED) return PostTimelineAction.APPROVED;
  if (status === PostStatus.NEEDS_REVISION) return PostTimelineAction.REJECTED;
  if (status === PostStatus.SCHEDULED) return PostTimelineAction.SCHEDULED;
  return PostTimelineAction.STATUS_CHANGED;
}

function human(status: PostStatus) {
  return status.toLowerCase().replace(/_/g, ' ');
}

function toDateOrNull(value?: string | null) {
  if (value === undefined) return undefined;
  return value ? new Date(value) : null;
}

/** An end date filter should include everything posted that day, not just midnight. */
function endOfDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}
