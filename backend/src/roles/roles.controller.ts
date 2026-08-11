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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query('companyId') companyId?: string,
  ) {
    return this.rolesService.findAll(actor, companyId);
  }

  @ApiOperation({ summary: 'Get a role with its assigned permissions.' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.rolesService.findOne(id, actor);
  }

  @ApiOperation({
    summary:
      'Create a role. SUPER_ADMIN can target any company; others create within their own.',
  })
  @RequirePermissions('roles:create')
  @Post()
  create(@Body() dto: CreateRoleDto, @CurrentUser() actor: CurrentUserPayload) {
    return this.rolesService.create(dto, actor);
  }

  @ApiOperation({
    summary: "Update a role's display name, description, or permissions.",
  })
  @RequirePermissions('roles:update')
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
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.rolesService.remove(id, actor);
  }
}
