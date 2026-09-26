import { Injectable, Logger } from '@nestjs/common';
import { ActivityAction, ActivityEntity, Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { buildMeta, toSkipTake } from '../common/utils/paginate.util';
import { PrismaService } from '../prisma/prisma.service';
import { ListActivityQueryDto } from './dto/list-activity-query.dto';

/** Never persist these, whatever a handler happens to return. */
const REDACTED_KEYS = new Set([
  'passwordHash',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'signatureUrl',
]);

export interface RecordActivityInput {
  actor: CurrentUserPayload;
  entity: ActivityEntity;
  action: ActivityAction;
  entityId: string;
  summary: string;
  afterState?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolves rather than rejects: an audit write must never turn a successful
   * request into a failed one. A dropped entry is logged for operators instead.
   */
  async record(input: RecordActivityInput): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: input.actor.id,
          entity: input.entity,
          action: input.action,
          entityId: input.entityId,
          summary: input.summary,
          afterState: redact(input.afterState),
          ipAddress: input.ipAddress?.slice(0, 45),
          userAgent: input.userAgent,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record ${input.action} on ${input.entity} ${input.entityId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async findAll(actor: CurrentUserPayload, filters: ListActivityQueryDto) {
    const where: Prisma.ActivityLogWhereInput = {
      ...this.scopeFilter(actor, filters.companyId),
      ...(filters.entity ? { entity: filters.entity } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.action ? { action: filters.action } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { data, meta: buildMeta(total, filters.page, filters.limit) };
  }

  /**
   * ActivityLog carries no companyId of its own, so a tenant's trail is the set of
   * entries written by its own users. Entries whose actor was since deleted
   * (userId nulled) therefore fall out of a company-scoped view.
   *
   * ponytail: add ActivityLog.companyId when that gap starts to matter — it needs
   * a migration and a backfill, which this slice does not.
   */
  private scopeFilter(
    actor: CurrentUserPayload,
    requestedCompanyId?: string,
  ): Prisma.ActivityLogWhereInput {
    if (actor.roleName === 'SUPER_ADMIN') {
      return requestedCompanyId
        ? { user: { companyId: requestedCompanyId } }
        : {};
    }
    return { user: { companyId: actor.companyId } };
  }
}

export function redact(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : undefined;
  if (value instanceof Date) return value.toISOString();
  // Money columns arrive as Decimal objects; spreading one would lose the value.
  if (Prisma.Decimal.isDecimal(value)) return value.toString();
  if (Array.isArray(value)) return value.map(redact) as Prisma.InputJsonValue;
  // bigint, symbol and function have no JSON form worth storing.
  if (typeof value !== 'object') return undefined;

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key)) continue;
    const cleaned = redact(entry);
    if (cleaned !== undefined) result[key] = cleaned;
  }
  return result as Prisma.InputJsonValue;
}
