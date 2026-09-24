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
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ListCampaignsQueryDto } from './dto/list-campaigns-query.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@ApiTags('Admin - Campaigns')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @ApiOperation({ summary: 'Create a campaign for a client.' })
  @RequirePermissions('campaigns:create')
  @LogActivity(ActivityEntity.CAMPAIGN, ActivityAction.CREATE)
  @Post()
  create(
    @Body() dto: CreateCampaignDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.campaignsService.create(dto, actor);
  }

  @ApiOperation({ summary: 'List campaigns, newest start date first.' })
  @RequirePermissions('campaigns:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListCampaignsQueryDto,
  ) {
    return this.campaignsService.findAll(actor, query);
  }

  @ApiOperation({
    summary: 'Get a campaign with its metric periods and derived performance.',
  })
  @RequirePermissions('campaigns:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.campaignsService.findOne(id, actor);
  }

  @ApiOperation({ summary: 'Update a campaign.' })
  @RequirePermissions('campaigns:update')
  @LogActivity(ActivityEntity.CAMPAIGN, ActivityAction.UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.campaignsService.update(id, dto, actor);
  }

  @ApiOperation({ summary: 'Soft-delete a campaign. Its posts are kept.' })
  @RequirePermissions('campaigns:delete')
  @LogActivity(ActivityEntity.CAMPAIGN, ActivityAction.SOFT_DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.campaignsService.remove(id, actor);
  }
}
