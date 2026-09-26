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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('Admin - Clients')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @ApiOperation({
    summary:
      'Create a client. SUPER_ADMIN can target any company; others create within their own.',
  })
  @RequirePermissions('clients:create')
  @LogActivity(ActivityEntity.CLIENT, ActivityAction.CREATE)
  @Post()
  create(
    @Body() dto: CreateClientDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.clientsService.create(dto, actor);
  }

  @ApiOperation({
    summary:
      'List clients. SUPER_ADMIN may pass ?companyId to filter; others are scoped to their own company.',
  })
  @RequirePermissions('clients:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListClientsQueryDto,
  ) {
    return this.clientsService.findAll(actor, query);
  }

  @ApiOperation({ summary: 'Get a client by id.' })
  @RequirePermissions('clients:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.clientsService.findOne(id, actor);
  }

  @ApiOperation({ summary: 'Update a client.' })
  @RequirePermissions('clients:update')
  @LogActivity(ActivityEntity.CLIENT, ActivityAction.UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.clientsService.update(id, dto, actor);
  }

  @ApiOperation({ summary: 'Soft-delete a client.' })
  @RequirePermissions('clients:delete')
  @LogActivity(ActivityEntity.CLIENT, ActivityAction.SOFT_DELETE)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.clientsService.remove(id, actor);
  }
}
