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
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto';
import { CreateSubTaskDto, CreateTaskDto } from './dto/create-task.dto';
import { ReorderTasksDto } from './dto/reorder-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('Admin - Tasks')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @ApiOperation({
    summary:
      'Create a task inside a project, optionally on one of its workspace boards.',
  })
  @RequirePermissions('tasks:create')
  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() actor: CurrentUserPayload) {
    return this.tasksService.create(dto, actor);
  }

  @ApiOperation({
    summary:
      'List top-level tasks. Without tasks:read a caller sees only their own tasks and the boards they belong to.',
  })
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.findAll(actor, query);
  }

  @ApiOperation({ summary: 'Get a task with its sub-tasks and comments.' })
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.tasksService.findOne(id, actor);
  }

  @ApiOperation({
    summary:
      'Reorder one status column, moving any dropped card into it. Declared before :id so the path is not read as an id.',
  })
  @RequirePermissions('tasks:update')
  @Patch('reorder')
  reorder(
    @Body() dto: ReorderTasksDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.tasksService.reorder(dto, actor);
  }

  @ApiOperation({
    summary:
      'Update a task. With tasks:update any field; otherwise the assignee may only change the status.',
  })
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.tasksService.update(id, dto, actor);
  }

  @ApiOperation({ summary: 'Soft-delete a task and its sub-tasks.' })
  @RequirePermissions('tasks:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.tasksService.remove(id, actor);
  }

  @ApiOperation({ summary: 'Add a sub-task under an existing task.' })
  @RequirePermissions('tasks:create')
  @Post(':id/subtasks')
  addSubTask(
    @Param('id') id: string,
    @Body() dto: CreateSubTaskDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.tasksService.addSubTask(id, dto, actor);
  }

  @ApiOperation({
    summary: 'Comment on a task. Anyone who can see the task can comment.',
  })
  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateTaskCommentDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.tasksService.addComment(id, dto, actor);
  }

  @ApiOperation({
    summary: 'Delete a comment (its author, or anyone with tasks:update).',
  })
  @Delete(':id/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.tasksService.removeComment(id, commentId, actor);
  }
}
