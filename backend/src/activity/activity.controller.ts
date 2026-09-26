import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ActivityService } from './activity.service';
import { ListActivityQueryDto } from './dto/list-activity-query.dto';

/** Read-only by design — there is no endpoint that writes or edits an entry. */
@ApiTags('Admin - Activity')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @ApiOperation({
    summary:
      'Audit trail, newest first. Filter by entity and entityId for a record timeline.',
  })
  @RequirePermissions('activity:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListActivityQueryDto,
  ) {
    return this.activityService.findAll(actor, query);
  }
}
