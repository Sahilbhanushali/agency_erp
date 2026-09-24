import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityEntity,
  NotificationType,
  PostStatus,
  PostTimelineAction,
  PublishStatus,
} from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { decryptSecret } from '../common/utils/crypto.util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { connectionState } from '../social-accounts/connection-state';
import { SocialProviderRegistry } from '../social-accounts/providers/social-provider';
import { AddPostTargetDto, MarkPublishedDto } from './dto/publish.dto';

/** Only content that has cleared review may be pushed anywhere. */
const PUBLISHABLE_STATUSES: PostStatus[] = [
  PostStatus.APPROVED,
  PostStatus.SCHEDULED,
];

const RETRYABLE: PublishStatus[] = [
  PublishStatus.PENDING,
  PublishStatus.SCHEDULED,
  PublishStatus.FAILED,
];

@Injectable()
export class PublishingService {
  private readonly logger = new Logger(PublishingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: SocialProviderRegistry,
    private readonly notifications: NotificationsService,
  ) {}

  async addTarget(
    postId: string,
    dto: AddPostTargetDto,
    actor: CurrentUserPayload,
  ) {
    const post = await this.loadPost(postId, actor);

    const account = await this.prisma.socialAccount.findFirst({
      where: { id: dto.socialAccountId, deletedAt: null },
    });
    if (!account) throw new NotFoundException('Social account not found');

    // Publishing one client's content to another client's audience would be a
    // serious breach, so the destination must belong to the same client.
    if (account.clientId !== post.clientId) {
      throw new BadRequestException(
        'That profile belongs to a different client.',
      );
    }
    if (account.companyId !== post.companyId) {
      throw new BadRequestException('That profile belongs to another company.');
    }

    const existing = await this.prisma.postTarget.findFirst({
      where: { postId, socialAccountId: dto.socialAccountId },
    });
    if (existing) {
      throw new BadRequestException(
        'This content already targets that profile.',
      );
    }

    await this.prisma.postTarget.create({
      data: {
        postId,
        socialAccountId: dto.socialAccountId,
        scheduledAt: dto.scheduledAt
          ? new Date(dto.scheduledAt)
          : post.scheduledDate,
        status: PublishStatus.PENDING,
      },
    });

    return this.listTargets(postId, actor);
  }

  async removeTarget(
    postId: string,
    targetId: string,
    actor: CurrentUserPayload,
  ) {
    await this.loadPost(postId, actor);
    const target = await this.prisma.postTarget.findFirst({
      where: { id: targetId, postId },
    });
    if (!target) throw new NotFoundException('Target not found');
    if (target.status === PublishStatus.PUBLISHED) {
      throw new BadRequestException(
        'This target is already published; removing it would erase the record that it went live.',
      );
    }
    await this.prisma.postTarget.delete({ where: { id: targetId } });
  }

  async listTargets(postId: string, actor: CurrentUserPayload) {
    await this.loadPost(postId, actor);
    const targets = await this.prisma.postTarget.findMany({
      where: { postId },
      include: {
        socialAccount: {
          select: {
            id: true,
            platform: true,
            accountName: true,
            externalId: true,
            isActive: true,
            accessToken: true,
            tokenExpiresAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Allowlisted rather than stripped, so the token cannot ride along by accident.
    return targets.map(({ socialAccount, ...target }) => ({
      ...target,
      socialAccount: {
        id: socialAccount.id,
        platform: socialAccount.platform,
        accountName: socialAccount.accountName,
        externalId: socialAccount.externalId,
        isActive: socialAccount.isActive,
        connectionState: connectionState(socialAccount),
        publishingAvailable: this.providers.supports(socialAccount.platform),
      },
    }));
  }

  /**
   * Attempts a real publish. Every outcome is recorded on the target and in the
   * post timeline, so a failure is visible rather than silent — and a target only
   * ever reads PUBLISHED when something actually returned a platform post id.
   */
  async publishTarget(
    postId: string,
    targetId: string,
    actor: CurrentUserPayload,
  ) {
    const post = await this.loadPost(postId, actor);
    this.assertPublishable(post.status);

    const target = await this.prisma.postTarget.findFirst({
      where: { id: targetId, postId },
      include: { socialAccount: true },
    });
    if (!target) throw new NotFoundException('Target not found');
    if (target.status === PublishStatus.PUBLISHED) {
      throw new BadRequestException('That target is already published.');
    }
    if (!RETRYABLE.includes(target.status)) {
      throw new BadRequestException(
        `A target in ${target.status} cannot be published.`,
      );
    }

    await this.prisma.postTarget.update({
      where: { id: targetId },
      data: { status: PublishStatus.PUBLISHING, failureReason: null },
    });

    const account = target.socialAccount;
    const provider = this.providers.get(account.platform);
    const state = connectionState(account);

    if (!provider) {
      return this.fail(
        post,
        targetId,
        actor,
        `No publishing provider is configured for ${account.platform}. Publish it on the platform, then record it here.`,
      );
    }
    if (state !== 'CONNECTED') {
      return this.fail(
        post,
        targetId,
        actor,
        `${account.accountName} is ${state.toLowerCase().replace('_', ' ')}. Reconnect the account and try again.`,
      );
    }

    try {
      const media = await this.prisma.postMedia.findMany({
        where: { postId },
        include: { file: { select: { storageKey: true } } },
        orderBy: { position: 'asc' },
      });

      const result = await provider.publish({
        externalId: account.externalId,
        accessToken: decryptSecret(account.accessToken),
        caption: post.caption,
        postType: post.postType,
        mediaUrls: media.map((item) => item.file.storageKey),
      });

      return this.succeed(
        post,
        targetId,
        actor,
        result.platformPostId,
        result.publishedAt,
        `published to ${account.accountName}`,
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : 'Publishing failed.';
      this.logger.error(`Publish failed for target ${targetId}: ${reason}`);
      return this.fail(post, targetId, actor, reason);
    }
  }

  /**
   * Records that a person published this by hand. Distinct from an API publish and
   * logged as such, but still evidence-backed: it demands the platform post id.
   */
  async markPublished(
    postId: string,
    targetId: string,
    dto: MarkPublishedDto,
    actor: CurrentUserPayload,
  ) {
    const post = await this.loadPost(postId, actor);
    this.assertPublishable(post.status);

    const target = await this.prisma.postTarget.findFirst({
      where: { id: targetId, postId },
      include: { socialAccount: { select: { accountName: true } } },
    });
    if (!target) throw new NotFoundException('Target not found');
    if (target.status === PublishStatus.PUBLISHED) {
      throw new BadRequestException('That target is already published.');
    }

    return this.succeed(
      post,
      targetId,
      actor,
      dto.platformPostId,
      dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
      `manually recorded as published to ${target.socialAccount.accountName} by ${actor.firstName}`,
    );
  }

  private async succeed(
    post: {
      id: string;
      status: PostStatus;
      title: string;
      createdById: string;
      assigneeId: string | null;
    },
    targetId: string,
    actor: CurrentUserPayload,
    platformPostId: string,
    publishedAt: Date,
    note: string,
  ) {
    await this.prisma.$transaction([
      this.prisma.postTarget.update({
        where: { id: targetId },
        data: {
          status: PublishStatus.PUBLISHED,
          platformPostId,
          publishedAt,
          failureReason: null,
        },
      }),
      this.prisma.postTimelineActivity.create({
        data: {
          postId: post.id,
          userId: actor.id,
          action: PostTimelineAction.PUBLISHED,
          note,
          toValue: platformPostId,
        },
      }),
    ]);

    await this.completePostIfAllTargetsPublished(post, actor);
    return this.listTargets(post.id, actor);
  }

  private async fail(
    post: { id: string },
    targetId: string,
    actor: CurrentUserPayload,
    reason: string,
  ) {
    await this.prisma.$transaction([
      this.prisma.postTarget.update({
        where: { id: targetId },
        data: { status: PublishStatus.FAILED, failureReason: reason },
      }),
      this.prisma.postTimelineActivity.create({
        data: {
          postId: post.id,
          userId: actor.id,
          action: PostTimelineAction.PUBLISH_FAILED,
          note: reason,
        },
      }),
    ]);

    return this.listTargets(post.id, actor);
  }

  /**
   * The post itself only reads PUBLISHED once every destination has gone live —
   * a partially published post is still in flight.
   */
  private async completePostIfAllTargetsPublished(
    post: {
      id: string;
      status: PostStatus;
      title: string;
      createdById: string;
      assigneeId: string | null;
    },
    actor: CurrentUserPayload,
  ) {
    const outstanding = await this.prisma.postTarget.count({
      where: { postId: post.id, status: { not: PublishStatus.PUBLISHED } },
    });
    if (outstanding > 0) return;
    if (!PUBLISHABLE_STATUSES.includes(post.status)) return;

    await this.prisma.$transaction([
      this.prisma.post.update({
        where: { id: post.id },
        data: { status: PostStatus.PUBLISHED },
      }),
      this.prisma.postTimelineActivity.create({
        data: {
          postId: post.id,
          userId: actor.id,
          action: PostTimelineAction.STATUS_CHANGED,
          fromValue: post.status,
          toValue: PostStatus.PUBLISHED,
          note: 'every destination published',
        },
      }),
    ]);

    void this.notifications.notify({
      userIds: [post.assigneeId, post.createdById],
      actorId: actor.id,
      type: NotificationType.POST_PUBLISHED,
      title: 'Content published',
      body: `"${post.title}" is live on every destination.`,
      entity: ActivityEntity.POST,
      entityId: post.id,
      actionUrl: `/content?postId=${post.id}`,
    });
  }

  private assertPublishable(status: PostStatus) {
    if (!PUBLISHABLE_STATUSES.includes(status)) {
      throw new BadRequestException(
        `Content must be approved before publishing. It is currently ${status}.`,
      );
    }
  }

  private async loadPost(postId: string, actor: CurrentUserPayload) {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
    });
    if (!post) throw new NotFoundException('Post not found');
    if (
      actor.roleName !== 'SUPER_ADMIN' &&
      post.companyId !== actor.companyId
    ) {
      throw new NotFoundException('Post not found');
    }
    return post;
  }
}
