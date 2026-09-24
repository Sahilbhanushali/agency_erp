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
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { ListQuotationsQueryDto } from './dto/list-quotations-query.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationsService } from './quotations.service';

@ApiTags('Admin - Quotations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @ApiOperation({
    summary:
      'Create a quotation with its line items. SUPER_ADMIN can target any company; others create within their own.',
  })
  @RequirePermissions('quotations:create')
  @Post()
  create(
    @Body() dto: CreateQuotationDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.quotationsService.create(dto, actor);
  }

  @ApiOperation({
    summary:
      'List quotations. SUPER_ADMIN may pass ?companyId; all callers may filter by ?clientId / ?projectId.',
  })
  @RequirePermissions('quotations:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() query: ListQuotationsQueryDto,
  ) {
    return this.quotationsService.findAll(actor, query);
  }

  @ApiOperation({ summary: 'Get a quotation with its line items.' })
  @RequirePermissions('quotations:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.quotationsService.findOne(id, actor);
  }

  @ApiOperation({
    summary:
      'Update a quotation. Passing lineItems replaces the full set (delete + recreate).',
  })
  @RequirePermissions('quotations:update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.quotationsService.update(id, dto, actor);
  }

  @ApiOperation({ summary: 'Soft-delete a quotation.' })
  @RequirePermissions('quotations:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.quotationsService.remove(id, actor);
  }
}
