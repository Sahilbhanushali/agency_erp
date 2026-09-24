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
import { CreateSocialAccountDto } from './dto/create-social-account.dto';
import { ListSocialAccountsQueryDto } from './dto/list-social-accounts-query.dto';
import { StoreCredentialsDto } from './dto/store-credentials.dto';
import { UpdateSocialAccountDto } from './dto/update-social-account.dto';
import { SocialProviderRegistry } from './providers/social-provider';
import { SocialAccountsService } from './social-accounts.service';

@ApiTags('Admin - Social Accounts')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('social-accounts')
export class SocialAccountsController {
  constructor(
    private readonly socialAccountsService: SocialAccountsService,
    private readonly providers: SocialProviderRegistry,
  ) {}

  @ApiOperation({
    summary:
      'Which platforms this deployment can actually publish to. Empty until a provider is registered.',
  })
  @Get('platforms')
  platforms() {
    return { publishablePlatforms: this.providers.connectedPlatforms() };
  }

  @ApiOperation({
    summary:
      'Register a client profile. Registering does not connect it — credentials are a separate step.',
  })
  @RequirePermissions('social_accounts:create')
  @LogActivity(ActivityEntity.SOCIAL_ACCOUNT, ActivityAction.CREATE)
  @Post()
  create(
    @Body() dto: CreateSocialAccountDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.socialAccountsService.create(dto, actor);
  }

  @ApiOperation({
    summary: 'List social accounts with their connection state.',
  })
  @RequirePermissions('social_accounts:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListSocialAccountsQueryDto,
  ) {
    return this.socialAccountsService.findAll(actor, query);
  }

  @ApiOperation({ summary: 'Get one account. Tokens are never returned.' })
  @RequirePermissions('social_accounts:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.socialAccountsService.findOne(id, actor);
  }

  @ApiOperation({ summary: 'Rename an account or switch it off.' })
  @RequirePermissions('social_accounts:update')
  @LogActivity(ActivityEntity.SOCIAL_ACCOUNT, ActivityAction.UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSocialAccountDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.socialAccountsService.update(id, dto, actor);
  }

  @ApiOperation({
    summary:
      'Store platform credentials, encrypted at rest. This is the seam an OAuth callback posts to.',
  })
  @RequirePermissions('social_accounts:update')
  @LogActivity(ActivityEntity.SOCIAL_ACCOUNT, ActivityAction.TOGGLE)
  @Post(':id/credentials')
  storeCredentials(
    @Param('id') id: string,
    @Body() dto: StoreCredentialsDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.socialAccountsService.storeCredentials(id, dto, actor);
  }

  @ApiOperation({
    summary: 'Disconnect: wipe stored credentials, keep the account.',
  })
  @RequirePermissions('social_accounts:update')
  @LogActivity(ActivityEntity.SOCIAL_ACCOUNT, ActivityAction.TOGGLE)
  @Delete(':id/credentials')
  revokeCredentials(
    @Param('id') id: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.socialAccountsService.revokeCredentials(id, actor);
  }

  @ApiOperation({
    summary:
      'Soft-delete an account. Refused while posts are still queued to it.',
  })
  @RequirePermissions('social_accounts:delete')
  @LogActivity(ActivityEntity.SOCIAL_ACCOUNT, ActivityAction.SOFT_DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.socialAccountsService.remove(id, actor);
  }
}
