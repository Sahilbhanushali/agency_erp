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
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Admin - Projects')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @ApiOperation({
    summary:
      'Create a project under a client. SUPER_ADMIN can target any company; others create within their own.',
  })
  @RequirePermissions('projects:create')
  @Post()
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.projectsService.create(dto, actor);
  }

  @ApiOperation({
    summary:
      'List projects. SUPER_ADMIN may pass ?companyId; all callers may filter by ?clientId.',
  })
  @RequirePermissions('projects:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query('companyId') companyId?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.projectsService.findAll(actor, companyId, clientId);
  }

  @ApiOperation({ summary: 'Get a project by id.' })
  @RequirePermissions('projects:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.projectsService.findOne(id, actor);
  }

  @ApiOperation({ summary: 'Update a project.' })
  @RequirePermissions('projects:update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.projectsService.update(id, dto, actor);
  }

  @ApiOperation({ summary: 'Soft-delete a project.' })
  @RequirePermissions('projects:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.projectsService.remove(id, actor);
  }
}
