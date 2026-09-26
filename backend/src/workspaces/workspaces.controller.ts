import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ActivityAction, ActivityEntity } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { ListWorkspacesQueryDto } from './dto/list-workspaces-query.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@ApiTags('Admin - Workspaces')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @ApiOperation({
    summary:
      'Create a workspace under a project. SUPER_ADMIN or a role with workspaces:create.',
  })
  @RequirePermissions('workspaces:create')
  @LogActivity(ActivityEntity.WORKSPACE, ActivityAction.CREATE)
  @Post()
  create(
    @Body() dto: CreateWorkspaceDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.workspacesService.create(dto, actor);
  }

  @ApiOperation({
    summary:
      'List workspaces. Filter by ?projectId; SUPER_ADMIN may also pass ?companyId.',
  })
  @RequirePermissions('workspaces:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListWorkspacesQueryDto,
  ) {
    return this.workspacesService.findAll(actor, query);
  }

  @ApiOperation({ summary: 'Get a workspace with its active members.' })
  @RequirePermissions('workspaces:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.workspacesService.findOne(id, actor);
  }

  @ApiOperation({ summary: 'Update a workspace.' })
  @RequirePermissions('workspaces:update')
  @LogActivity(ActivityEntity.WORKSPACE, ActivityAction.UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.workspacesService.update(id, dto, actor);
  }

  @ApiOperation({ summary: 'Soft-delete a workspace.' })
  @RequirePermissions('workspaces:delete')
  @LogActivity(ActivityEntity.WORKSPACE, ActivityAction.SOFT_DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.workspacesService.remove(id, actor);
  }

  @ApiOperation({ summary: 'Add an employee to the workspace.' })
  @RequirePermissions('workspaces:update')
  @Post(':id/members')
  addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.workspacesService.addMember(id, dto, actor);
  }

  @ApiOperation({ summary: 'Remove an employee from the workspace.' })
  @RequirePermissions('workspaces:update')
  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.workspacesService.removeMember(id, userId, actor);
  }
}
