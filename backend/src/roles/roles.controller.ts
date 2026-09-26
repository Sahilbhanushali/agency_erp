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
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@ApiTags('Admin - Roles')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @ApiOperation({
    summary:
      'List roles. SUPER_ADMIN may pass ?companyId; others are scoped to their own company.',
  })
  @RequirePermissions('roles:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListRolesQueryDto,
  ) {
    return this.rolesService.findAll(actor, query);
  }

  @ApiOperation({ summary: 'Get a role with its assigned permissions.' })
  @RequirePermissions('roles:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.rolesService.findOne(id, actor);
  }

  @ApiOperation({
    summary:
      'Create a role. SUPER_ADMIN can target any company; others create within their own.',
  })
  @RequirePermissions('roles:create')
  @LogActivity(ActivityEntity.ROLE, ActivityAction.CREATE)
  @Post()
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: CurrentUserPayload) {
    return this.rolesService.create(dto, actor);
  }

  @ApiOperation({
    summary: "Update a role's display name, description, or permissions.",
  })
  @RequirePermissions('roles:update')
  @LogActivity(ActivityEntity.ROLE, ActivityAction.UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.rolesService.update(id, dto, actor);
  }

  @ApiOperation({
    summary: 'Soft-delete a role (must have no assigned users).',
  })
  @RequirePermissions('roles:delete')
  @LogActivity(ActivityEntity.ROLE, ActivityAction.SOFT_DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.rolesService.remove(id, actor);
  }
}
