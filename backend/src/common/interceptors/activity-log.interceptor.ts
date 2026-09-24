import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ActivityAction } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { ActivityService } from '../../activity/activity.service';
import type { CurrentUserPayload } from '../../auth/decorators/current-user.decorator';
import {
  LOG_ACTIVITY_KEY,
  type LogActivityMeta,
} from '../decorators/log-activity.decorator';

const PAST_TENSE: Record<ActivityAction, string> = {
  CREATE: 'created',
  UPDATE: 'updated',
  SOFT_DELETE: 'deleted',
  RESTORE: 'restored',
  LOGIN: 'signed in',
  LOGOUT: 'signed out',
  APPROVE: 'approved',
  REJECT: 'rejected',
  SEND: 'sent',
  EXPORT: 'exported',
  UPLOAD: 'uploaded',
  DOWNLOAD: 'downloaded',
  TOGGLE: 'toggled',
  ASSIGN: 'assigned',
  UNASSIGN: 'unassigned',
};

/** Fields worth showing a human, in the order we would rather name a record by. */
const LABEL_KEYS = [
  'name',
  'title',
  'invoiceNumber',
  'quotationNumber',
  'displayName',
  'email',
];

interface AuditedRequest {
  user?: CurrentUserPayload;
  params?: Record<string, string>;
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly activity: ActivityService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<LogActivityMeta | undefined>(
      LOG_ACTIVITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const actor = request.user;
    if (!actor) return next.handle();

    return next.handle().pipe(
      tap((response: unknown) => {
        // A delete returns no body, so fall back to the id in the route.
        const entityId = readString(response, 'id') ?? request.params?.id;
        if (!entityId) return;

        // Deliberately not awaited: the response should not wait on the audit
        // write, and record() resolves even when that write fails.
        void this.activity.record({
          actor,
          entity: meta.entity,
          action: meta.action,
          entityId,
          summary: buildSummary(actor, meta, response),
          afterState:
            meta.action === ActivityAction.SOFT_DELETE ? undefined : response,
          ipAddress: request.ip,
          userAgent: header(request, 'user-agent'),
        });
      }),
    );
  }
}

function buildSummary(
  actor: CurrentUserPayload,
  meta: LogActivityMeta,
  response: unknown,
): string {
  const subject = meta.entity.toLowerCase().replace(/_/g, ' ');
  const label = LABEL_KEYS.map((key) => readString(response, key)).find(
    Boolean,
  );
  const verb = PAST_TENSE[meta.action];

  return label
    ? `${actor.firstName} ${verb} ${subject} "${label}"`
    : `${actor.firstName} ${verb} a ${subject}`;
}

function readString(source: unknown, key: string): string | undefined {
  if (!source || typeof source !== 'object') return undefined;
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function header(request: AuditedRequest, key: string): string | undefined {
  const value = request.headers?.[key];
  return Array.isArray(value) ? value[0] : value;
}
