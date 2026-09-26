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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ActivityAction, ActivityEntity } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogActivity } from '../common/decorators/log-activity.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { CreateSkillDto } from './dto/create-skill.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpsertBankDetailDto } from './dto/upsert-bank-detail.dto';
import { UpsertEmployeeProfileDto } from './dto/upsert-employee-profile.dto';
import { UsersService } from './users.service';

@ApiTags('Admin - Users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({
    summary:
      'Create a user/employee. SUPER_ADMIN can target any company; others create within their own.',
  })
  @RequirePermissions('users:create')
  @LogActivity(ActivityEntity.USER, ActivityAction.CREATE)
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: CurrentUserPayload) {
    return this.usersService.create(dto, actor);
  }

  @ApiOperation({
    summary:
      'List users. SUPER_ADMIN may pass ?companyId to filter; others are scoped to their own company.',
  })
  @RequirePermissions('users:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListUsersQueryDto,
  ) {
    return this.usersService.findAll(actor, query);
  }

  @ApiOperation({
    summary: 'Get a user with employee profile, bank detail and skills.',
  })
  @RequirePermissions('users:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.usersService.findOne(id, actor);
  }

  @ApiOperation({ summary: "Update a user's basic details." })
  @RequirePermissions('users:update')
  @LogActivity(ActivityEntity.USER, ActivityAction.UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.usersService.update(id, dto, actor);
  }

  @ApiOperation({ summary: 'Soft-delete a user.' })
  @RequirePermissions('users:delete')
  @LogActivity(ActivityEntity.USER, ActivityAction.SOFT_DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.usersService.remove(id, actor);
  }

  @ApiOperation({
    summary:
      'Create or update the employee profile (extended personal details).',
  })
  @RequirePermissions('users:update')
  @Patch(':id/profile')
  upsertProfile(
    @Param('id') id: string,
    @Body() dto: UpsertEmployeeProfileDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.usersService.upsertProfile(id, dto, actor);
  }

  @ApiOperation({
    summary:
      'Create or update the employee bank detail (requires an employee profile to exist).',
  })
  @RequirePermissions('users:update')
  @Patch(':id/bank-detail')
  upsertBankDetail(
    @Param('id') id: string,
    @Body() dto: UpsertBankDetailDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.usersService.upsertBankDetail(id, dto, actor);
  }

  @ApiOperation({ summary: 'Add a skill to the employee profile.' })
  @RequirePermissions('users:update')
  @Post(':id/skills')
  addSkill(
    @Param('id') id: string,
    @Body() dto: CreateSkillDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.usersService.addSkill(id, dto, actor);
  }

  @ApiOperation({ summary: 'Remove a skill from the employee profile.' })
  @RequirePermissions('users:update')
  @Delete(':id/skills/:skillId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSkill(
    @Param('id') id: string,
    @Param('skillId') skillId: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.usersService.removeSkill(id, skillId, actor);
  }

  @ApiOperation({
    summary: 'Upload a document for the employee (stored on local disk).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        isClientVisible: { type: 'boolean' },
      },
      required: ['file', 'name'],
    },
  })
  @RequirePermissions('users:update')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @Post(':id/documents')
  addDocument(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.usersService.addDocument(id, file, dto, actor);
  }

  @ApiOperation({ summary: "List an employee's documents." })
  @RequirePermissions('users:read')
  @Get(':id/documents')
  listDocuments(
    @Param('id') id: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.usersService.listDocuments(id, actor);
  }

  @ApiOperation({ summary: "Download an employee's document file." })
  @RequirePermissions('users:read')
  @Get(':id/documents/:documentId/download')
  async downloadDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() actor: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const file = await this.usersService.getDocumentFile(id, documentId, actor);
    res.download(file.absolutePath, file.originalName);
  }

  @ApiOperation({
    summary: 'Delete an employee document (also removes the file from disk).',
  })
  @RequirePermissions('users:update')
  @Delete(':id/documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.usersService.removeDocument(id, documentId, actor);
  }

  @ApiOperation({
    summary:
      'Send a fresh invite to someone whose first one never arrived (e.g. a mail outage).',
  })
  @RequirePermissions('users:update')
  @LogActivity(ActivityEntity.USER, ActivityAction.SEND)
  @Post(':id/resend-invite')
  resendInvite(
    @Param('id') id: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.usersService.resendInvite(id, actor);
  }
}
