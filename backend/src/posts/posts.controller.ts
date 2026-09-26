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
import { CreatePostDto } from './dto/create-post.dto';
import { AddPostTargetDto, MarkPublishedDto } from './dto/publish.dto';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { AddPostReferenceDto } from './dto/post-reference.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';
import { PublishingService } from './publishing.service';

@ApiTags('Admin - Content')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly publishing: PublishingService,
  ) {}

  @ApiOperation({
    summary: 'Raise a new piece of content as an idea or draft.',
  })
  @RequirePermissions('posts:create')
  @LogActivity(ActivityEntity.POST, ActivityAction.CREATE)
  @Post()
  create(@Body() dto: CreatePostDto, @CurrentUser() actor: CurrentUserPayload) {
    return this.postsService.create(dto, actor);
  }

  @ApiOperation({
    summary:
      'List content, soonest scheduled first. Date filters drive the content calendar.',
  })
  @RequirePermissions('posts:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListPostsQueryDto,
  ) {
    return this.postsService.findAll(actor, query);
  }

  @ApiOperation({
    summary:
      'Get one piece of content with its production timeline, references and media.',
  })
  @RequirePermissions('posts:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.postsService.findOne(id, actor);
  }

  @ApiOperation({
    summary:
      'Update content. Status changes must follow the production workflow.',
  })
  @RequirePermissions('posts:update')
  @LogActivity(ActivityEntity.POST, ActivityAction.UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.postsService.update(id, dto, actor);
  }

  @ApiOperation({ summary: 'Soft-delete content.' })
  @RequirePermissions('posts:delete')
  @LogActivity(ActivityEntity.POST, ActivityAction.SOFT_DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.postsService.remove(id, actor);
  }

  @ApiOperation({ summary: 'Attach a reference link to the brief.' })
  @RequirePermissions('posts:update')
  @Post(':id/references')
  addReference(
    @Param('id') id: string,
    @Body() dto: AddPostReferenceDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.postsService.addReference(id, dto, actor);
  }

  @ApiOperation({ summary: 'Remove a reference link.' })
  @RequirePermissions('posts:update')
  @Delete(':id/references/:referenceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeReference(
    @Param('id') id: string,
    @Param('referenceId') referenceId: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.postsService.removeReference(id, referenceId, actor);
  }

  @ApiOperation({
    summary: 'Destinations this content publishes to, with their state.',
  })
  @RequirePermissions('posts:read')
  @Get(':id/targets')
  listTargets(
    @Param('id') id: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.publishing.listTargets(id, actor);
  }

  @ApiOperation({
    summary:
      'Queue a destination. Must be a profile belonging to the same client.',
  })
  @RequirePermissions('posts:update')
  @Post(':id/targets')
  addTarget(
    @Param('id') id: string,
    @Body() dto: AddPostTargetDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.publishing.addTarget(id, dto, actor);
  }

  @ApiOperation({
    summary: 'Remove a queued destination that has not published.',
  })
  @RequirePermissions('posts:update')
  @Delete(':id/targets/:targetId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTarget(
    @Param('id') id: string,
    @Param('targetId') targetId: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.publishing.removeTarget(id, targetId, actor);
  }

  @ApiOperation({
    summary:
      'Attempt to publish to one destination. Records the outcome either way; never marks success without a platform post id.',
  })
  @RequirePermissions('posts:publish')
  @LogActivity(ActivityEntity.POST, ActivityAction.SEND)
  @Post(':id/targets/:targetId/publish')
  publishTarget(
    @Param('id') id: string,
    @Param('targetId') targetId: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.publishing.publishTarget(id, targetId, actor);
  }

  @ApiOperation({
    summary:
      'Record that a person published this by hand, evidenced by the platform post id.',
  })
  @RequirePermissions('posts:publish')
  @LogActivity(ActivityEntity.POST, ActivityAction.SEND)
  @Post(':id/targets/:targetId/mark-published')
  markPublished(
    @Param('id') id: string,
    @Param('targetId') targetId: string,
    @Body() dto: MarkPublishedDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.publishing.markPublished(id, targetId, dto, actor);
  }
}
