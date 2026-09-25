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
import { ActivityAction, ActivityEntity } from '@prisma/client';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { CreateLeadDto } from './dto/create-lead.dto';
import {
  ConvertLeadDto,
  LogLeadActivityDto,
  ReorderLeadsDto,
} from './dto/lead-actions.dto';
import { ListLeadsQueryDto } from './dto/list-leads-query.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@ApiTags('Admin - Leads')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @ApiOperation({ summary: 'Add a lead to the pipeline.' })
  @RequirePermissions('leads:create')
  @LogActivity(ActivityEntity.LEAD, ActivityAction.CREATE)
  @Post()
  create(@Body() dto: CreateLeadDto, @CurrentUser() actor: CurrentUserPayload) {
    return this.leadsService.create(dto, actor);
  }

  @ApiOperation({
    summary:
      'List leads. followUpDue=true is the chase list; openOnly=true hides won and lost.',
  })
  @RequirePermissions('leads:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListLeadsQueryDto,
  ) {
    return this.leadsService.findAll(actor, query);
  }

  @ApiOperation({ summary: 'Count and estimated value per pipeline stage.' })
  @RequirePermissions('leads:read')
  @Get('pipeline')
  pipeline(
    @CurrentUser() actor: CurrentUserPayload,
    @Query('companyId') companyId?: string,
  ) {
    return this.leadsService.pipelineSummary(actor, companyId);
  }

  @ApiOperation({
    summary: 'Reorder one pipeline column, moving any dropped card into it.',
  })
  @RequirePermissions('leads:update')
  @Patch('reorder')
  reorder(
    @Body() dto: ReorderLeadsDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.leadsService.reorder(dto, actor);
  }

  @ApiOperation({ summary: 'Get a lead with its full activity history.' })
  @RequirePermissions('leads:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.leadsService.findOne(id, actor);
  }

  @ApiOperation({ summary: 'Update a lead. Moving to LOST requires a reason.' })
  @RequirePermissions('leads:update')
  @LogActivity(ActivityEntity.LEAD, ActivityAction.UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.leadsService.update(id, dto, actor);
  }

  @ApiOperation({
    summary: 'Log a call, email, meeting or note against the lead.',
  })
  @RequirePermissions('leads:update')
  @Post(':id/activities')
  logActivity(
    @Param('id') id: string,
    @Body() dto: LogLeadActivityDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.leadsService.logActivity(id, dto, actor);
  }

  @ApiOperation({
    summary:
      'Turn a lead into a client, keeping the lead linked as its origin.',
  })
  @RequirePermissions('leads:update', 'clients:create')
  @LogActivity(ActivityEntity.LEAD, ActivityAction.UPDATE)
  @Post(':id/convert')
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertLeadDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.leadsService.convert(id, dto, actor);
  }

  @ApiOperation({ summary: 'Soft-delete a lead that never became a client.' })
  @RequirePermissions('leads:delete')
  @LogActivity(ActivityEntity.LEAD, ActivityAction.SOFT_DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.leadsService.remove(id, actor);
  }
}
