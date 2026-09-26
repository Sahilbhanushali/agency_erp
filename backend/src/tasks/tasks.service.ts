import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityEntity,
  NotificationType,
  Prisma,
  TaskStatus,
} from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { buildMeta, toSkipTake } from '../common/utils/paginate.util';
import { NotificationsService } from '../notifications/notifications.service';
import {
  assertCompanyAccess,
  hasPermission,
  taskScopeFilter,
} from '../common/utils/tenant-scope.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { CreateSubTaskDto, CreateTaskDto } from './dto/create-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const USER_SELECT = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatarUrl: true,
  },
} as const;

const TASK_INCLUDE = {
  assignee: USER_SELECT,
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  project: { select: { id: true, title: true } },
  workspace: { select: { id: true, name: true, colorHex: true } },
  subTasks: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: { assignee: USER_SELECT },
  },
  _count: { select: { comments: { where: { deletedAt: null } } } },
} as const;

const TASK_DETAIL_INCLUDE = {
  ...TASK_INCLUDE,
  comments: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: { user: USER_SELECT },
  },
} as const;

/** Anything not finished or abandoned, i.e. still real work. */
const OPEN_TASK_STATUSES = [
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
  TaskStatus.NEEDS_REVISION,
  TaskStatus.ADMIN_APPROVED,
  TaskStatus.CLIENT_PENDING,
];

// TaskPriority ascends LOW -> URGENT, so desc puts the most urgent first.
const TASK_ORDER_BY = {
  board: [{ position: 'asc' }, { createdAt: 'desc' }],
  priority: [{ priority: 'desc' }, { dueDate: 'asc' }],
  dueDate: [{ dueDate: 'asc' }],
} satisfies Record<string, Prisma.TaskOrderByWithRelationInput[]>;

function humanStatus(status: TaskStatus) {
  return status.toLowerCase().replace(/_/g, ' ');
}

/** undefined leaves the column untouched; null clears it. */
function toNullableDate(value?: string | null) {
  if (value === undefined) return undefined;
  return value === null ? null : new Date(value);
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Deep link the notification opens; the board reads taskId and opens that card. */
  private taskUrl(taskId: string) {
    return `/tasks?taskId=${taskId}`;
  }

  async create(dto: CreateTaskDto, actor: CurrentUserPayload) {
    const project = await this.loadProject(dto.projectId, actor);
    await this.assertWorkspaceInProject(dto.workspaceId, project.id);
    await this.assertAssigneeInCompany(dto.assigneeId, project.companyId);

    const task = await this.prisma.task.create({
      data: {
        companyId: project.companyId,
        projectId: project.id,
        workspaceId: dto.workspaceId,
        createdById: actor.id,
        assigneeId: dto.assigneeId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate: toNullableDate(dto.dueDate),
        completedAt: dto.status === TaskStatus.DONE ? new Date() : null,
      },
      include: TASK_INCLUDE,
    });

    if (task.assigneeId) {
      void this.notifications.notify({
        userIds: [task.assigneeId],
        actorId: actor.id,
        type: NotificationType.TASK_ASSIGNED,
        title: 'New task assigned to you',
        body: `${actor.firstName} assigned you "${task.title}".`,
        entity: ActivityEntity.TASK,
        entityId: task.id,
        actionUrl: this.taskUrl(task.id),
      });
    }

    return task;
  }

  async findAll(actor: CurrentUserPayload, filters: ListTasksQueryDto) {
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      // Sub-tasks travel with their parent rather than as board cards of their own.
      parentTaskId: null,
      ...this.scopeFilter(actor, filters.companyId),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.workspaceId ? { workspaceId: filters.workspaceId } : {}),
      ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { title: { contains: filters.search } } : {}),
      ...(filters.openOnly ? { status: { in: OPEN_TASK_STATUSES } } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: TASK_ORDER_BY[filters.sort ?? 'board'],
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.task.count({ where }),
    ]);

    return { data, meta: buildMeta(total, filters.page, filters.limit) };
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null, ...this.scopeFilter(actor) },
      include: TASK_DETAIL_INCLUDE,
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(id: string, dto: UpdateTaskDto, actor: CurrentUserPayload) {
    const task = await this.findOne(id, actor);
    this.assertCanEdit(task, dto, actor);

    if (dto.workspaceId !== undefined)
      await this.assertWorkspaceInProject(dto.workspaceId, task.projectId);
    if (dto.assigneeId)
      await this.assertAssigneeInCompany(dto.assigneeId, task.companyId);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        workspaceId: dto.workspaceId,
        assigneeId: dto.assigneeId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        position: dto.position,
        dueDate: toNullableDate(dto.dueDate),
        ...(dto.status && {
          completedAt:
            dto.status === TaskStatus.DONE
              ? (task.completedAt ?? new Date())
              : null,
        }),
      },
      include: TASK_INCLUDE,
    });

    if (dto.assigneeId && dto.assigneeId !== task.assigneeId) {
      void this.notifications.notify({
        userIds: [dto.assigneeId],
        actorId: actor.id,
        type: NotificationType.TASK_ASSIGNED,
        title: 'New task assigned to you',
        body: `${actor.firstName} assigned you "${updated.title}".`,
        entity: ActivityEntity.TASK,
        entityId: updated.id,
        actionUrl: this.taskUrl(updated.id),
      });
    }

    if (dto.status && dto.status !== task.status) {
      // The people who care are whoever owns it and whoever raised it.
      void this.notifications.notify({
        userIds: [updated.assigneeId, updated.createdById].filter(
          (id): id is string => !!id,
        ),
        actorId: actor.id,
        type: NotificationType.TASK_STATUS_CHANGED,
        title: 'Task status changed',
        body: `${actor.firstName} moved "${updated.title}" from ${humanStatus(task.status)} to ${humanStatus(dto.status)}.`,
        entity: ActivityEntity.TASK,
        entityId: updated.id,
        actionUrl: this.taskUrl(updated.id),
      });
    }

    return updated;
  }

  /** Drag and drop: rewrites one column's order and moves any dropped card into it. */
  async reorder(dto: ReorderTasksDto, actor: CurrentUserPayload) {
    const visible = await this.prisma.task.findMany({
      where: {
        id: { in: dto.taskIds },
        deletedAt: null,
        ...this.scopeFilter(actor),
      },
      select: { id: true, completedAt: true },
    });
    if (visible.length !== dto.taskIds.length) {
      throw new NotFoundException('One or more tasks were not found');
    }

    const completedAtById = new Map(
      visible.map((task) => [task.id, task.completedAt]),
    );
    const isDone = dto.status === TaskStatus.DONE;

    await this.prisma.$transaction(
      dto.taskIds.map((id, position) =>
        this.prisma.task.update({
          where: { id },
          data: {
            position,
            status: dto.status,
            completedAt: isDone
              ? (completedAtById.get(id) ?? new Date())
              : null,
          },
        }),
      ),
    );

    return this.prisma.task.findMany({
      where: { id: { in: dto.taskIds } },
      include: TASK_INCLUDE,
      orderBy: { position: 'asc' },
    });
  }

  async remove(id: string, actor: CurrentUserPayload) {
    await this.findOne(id, actor);
    const data = { deletedAt: new Date(), deletedBy: actor.id };

    await this.prisma.$transaction([
      this.prisma.task.update({ where: { id }, data }),
      this.prisma.task.updateMany({
        where: { parentTaskId: id, deletedAt: null },
        data,
      }),
    ]);
  }

  async addSubTask(
    parentId: string,
    dto: CreateSubTaskDto,
    actor: CurrentUserPayload,
  ) {
    const parent = await this.findOne(parentId, actor);
    if (parent.parentTaskId)
      throw new BadRequestException('A sub-task cannot have its own sub-tasks');
    await this.assertAssigneeInCompany(dto.assigneeId, parent.companyId);

    return this.prisma.task.create({
      data: {
        companyId: parent.companyId,
        projectId: parent.projectId,
        workspaceId: parent.workspaceId,
        parentTaskId: parent.id,
        createdById: actor.id,
        assigneeId: dto.assigneeId,
        title: dto.title,
        dueDate: toNullableDate(dto.dueDate),
      },
      include: { assignee: USER_SELECT },
    });
  }

  async addComment(
    taskId: string,
    dto: CreateTaskCommentDto,
    actor: CurrentUserPayload,
  ) {
    await this.findOne(taskId, actor);

    return this.prisma.taskComment.create({
      data: { taskId, userId: actor.id, content: dto.content },
      include: { user: USER_SELECT },
    });
  }

  async removeComment(
    taskId: string,
    commentId: string,
    actor: CurrentUserPayload,
  ) {
    await this.findOne(taskId, actor);

    const comment = await this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId, deletedAt: null },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== actor.id && !hasPermission(actor, 'tasks:update')) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.taskComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
  }

  /**
   * Without `tasks:read` a user still sees the work they own — their own tasks and
   * the boards they are a member of — so employees do not need a permission to use
   * their own to-do list.
   */
  private scopeFilter(
    actor: CurrentUserPayload,
    requestedCompanyId?: string,
  ): Prisma.TaskWhereInput {
    return taskScopeFilter(actor, requestedCompanyId);
  }

  /** An assignee without `tasks:update` may move their own task along, nothing else. */
  private assertCanEdit(
    task: { assigneeId: string | null },
    dto: UpdateTaskDto,
    actor: CurrentUserPayload,
  ) {
    if (hasPermission(actor, 'tasks:update')) return;
    if (task.assigneeId !== actor.id) {
      throw new ForbiddenException('You can only update tasks assigned to you');
    }
    const beyondOwnWork = Object.keys(dto).filter(
      (field) => field !== 'status' && field !== 'position',
    );
    if (beyondOwnWork.length > 0) {
      throw new ForbiddenException(
        'You can only move tasks assigned to you, not edit them',
      );
    }
  }

  private async loadProject(projectId: string, actor: CurrentUserPayload) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) throw new BadRequestException('Project not found');
    assertCompanyAccess(project.companyId, actor);
    return project;
  }

  private async assertWorkspaceInProject(
    workspaceId: string | null | undefined,
    projectId: string,
  ) {
    if (!workspaceId) return;
    const workspace = await this.prisma.workspace.findFirst({
      where: { id: workspaceId, projectId, deletedAt: null },
    });
    if (!workspace)
      throw new BadRequestException('Workspace not found in this project');
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
