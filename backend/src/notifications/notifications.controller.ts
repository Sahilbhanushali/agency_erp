import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

/** Always the caller's own notifications — there is no way to read someone else's. */
@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @ApiOperation({
    summary: 'Your notifications, unread first. meta.unread drives the badge.',
  })
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.findAll(actor, query);
  }

  @ApiOperation({ summary: 'Mark every unread notification as read.' })
  @Patch('read-all')
  markAllRead(@CurrentUser() actor: CurrentUserPayload) {
    return this.notificationsService.markAllRead(actor);
  }

  @ApiOperation({ summary: 'Mark one notification as read.' })
  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.notificationsService.markRead(id, actor);
  }
}
