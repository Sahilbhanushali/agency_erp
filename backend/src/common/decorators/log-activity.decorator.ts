import { SetMetadata } from '@nestjs/common';
import { ActivityAction, ActivityEntity } from '@prisma/client';

export const LOG_ACTIVITY_KEY = 'log_activity';

export interface LogActivityMeta {
  entity: ActivityEntity;
  action: ActivityAction;
}

/**
 * Records an audit entry after the handler succeeds. A failed request is never
 * logged, so the trail only ever contains things that actually happened.
 */
export const LogActivity = (entity: ActivityEntity, action: ActivityAction) =>
  SetMetadata<string, LogActivityMeta>(LOG_ACTIVITY_KEY, { entity, action });
