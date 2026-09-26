import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActivityAction, ActivityEntity } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ApprovalsService } from './approvals.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { DecideApprovalDto } from './dto/decide-approval.dto';
import { ListApprovalsQueryDto } from './dto/list-approvals-query.dto';

/**
 * Decisions are append-only: there is no endpoint that edits or deletes one, which
 * is what makes the approval history worth trusting.
 */
@ApiTags('Admin - Approvals')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @ApiOperation({ summary: 'Ask someone to sign off on a record.' })
  @RequirePermissions('approvals:create')
  @LogActivity(ActivityEntity.APPROVAL, ActivityAction.CREATE)
  @Post()
  create(
    @Body() dto: CreateApprovalDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.approvalsService.create(dto, actor);
  }

  @ApiOperation({
    summary:
      'List approvals, oldest pending first. Use mine=true for your own queue.',
  })
  @RequirePermissions('approvals:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListApprovalsQueryDto,
  ) {
    return this.approvalsService.findAll(actor, query);
  }

  @ApiOperation({ summary: 'One approval with its full decision trail.' })
  @RequirePermissions('approvals:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.approvalsService.findOne(id, actor);
  }

  @ApiOperation({
    summary:
      'Approve, reject, request changes, or just comment. A decided approval takes no second verdict.',
  })
  @RequirePermissions('approvals:read')
  @LogActivity(ActivityEntity.APPROVAL, ActivityAction.APPROVE)
  @Post(':id/decisions')
  decide(
    @Param('id') id: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.approvalsService.decide(id, dto, actor);
  }

  @ApiOperation({ summary: 'Withdraw an approval that has not been decided.' })
  @RequirePermissions('approvals:read')
  @LogActivity(ActivityEntity.APPROVAL, ActivityAction.UPDATE)
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.approvalsService.cancel(id, actor);
  }
}
