import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActivityEntity, NotificationType, Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { buildMeta, toSkipTake } from '../common/utils/paginate.util';
import { PrismaService } from '../prisma/prisma.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';

/** Deduplicates, drops blanks, and never notifies whoever performed the action. */
export function resolveRecipients(
  userIds: (string | null | undefined)[],
  actorId?: string,
): string[] {
  return [...new Set(userIds)].filter(
    (id): id is string => !!id && id !== actorId,
  );
}

export interface NotifyInput {
  /** Recipients. Anyone equal to actorId is dropped — nobody needs telling what they just did. */
  userIds: (string | null | undefined)[];
  actorId?: string;
  type: NotificationType;
  title: string;
  body: string;
  entity?: ActivityEntity;
  entityId?: string;
  /** In-app route the notification opens, e.g. /tasks?taskId=abc. */
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves rather than rejects: a notification is a side effect of the real
   * request and must never be the reason that request fails.
   */
  async notify(input: NotifyInput): Promise<void> {
    const recipients = resolveRecipients(input.userIds, input.actorId);
    if (recipients.length === 0) return;

    try {
      const allowed = await this.filterByPreference(recipients, input.type);
      if (allowed.length === 0) return;

      await this.prisma.notification.createMany({
        data: allowed.map((userId) => ({
          userId,
          notificationType: input.type,
          title: input.title,
          body: input.body,
          entity: input.entity,
          entityId: input.entityId,
          actionUrl: input.actionUrl,
        })),
      });
    } catch (error) {
      this.logger.error(
        `Failed to deliver ${input.type} to ${recipients.length} user(s)`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** Absent preference rows mean "not configured", which defaults to enabled. */
  private async filterByPreference(userIds: string[], type: NotificationType) {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId: { in: userIds }, notificationType: type },
      select: { userId: true, inApp: true },
    });
    const muted = new Set(
      preferences.filter((p) => !p.inApp).map((p) => p.userId),
    );
    return userIds.filter((id) => !muted.has(id));
  }

  async findAll(actor: CurrentUserPayload, filters: ListNotificationsQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      userId: actor.id,
      ...(filters.unreadOnly ? { readAt: null } : {}),
    };

    const [data, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        // Unread first, then newest, so the badge and the list agree on what is pending.
        orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId: actor.id, readAt: null },
      }),
    ]);

    return {
      data,
      meta: { ...buildMeta(total, filters.page, filters.limit), unread },
    };
  }

  async markRead(id: string, actor: CurrentUserPayload) {
    // Scoped by userId in the same statement, so one user cannot touch another's row.
    const { count } = await this.prisma.notification.updateMany({
      where: { id, userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (count === 0) await this.assertExists(id, actor);
    return { id, readAt: new Date() };
  }

  async markAllRead(actor: CurrentUserPayload) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId: actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { marked: count };
  }

  private async assertExists(id: string, actor: CurrentUserPayload) {
    const exists = await this.prisma.notification.findFirst({
      where: { id, userId: actor.id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Notification not found');
  }
}
