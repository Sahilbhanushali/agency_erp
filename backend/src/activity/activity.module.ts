import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ActivityLogInterceptor } from '../common/interceptors/activity-log.interceptor';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

/**
 * Global so any controller can opt in with @LogActivity without wiring imports,
 * which is what keeps the audit trail from quietly skipping a new module.
 */
@Global()
@Module({
  controllers: [ActivityController],
  providers: [
    ActivityService,
    { provide: APP_INTERCEPTOR, useClass: ActivityLogInterceptor },
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
