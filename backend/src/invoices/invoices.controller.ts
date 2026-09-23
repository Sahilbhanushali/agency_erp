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
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('Admin - Invoices')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @ApiOperation({
    summary:
      'Create an invoice with its line items. SUPER_ADMIN can target any company; others create within their own.',
  })
  @RequirePermissions('invoices:create')
  @Post()
  create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.invoicesService.create(dto, actor);
  }

  @ApiOperation({
    summary:
      'List invoices. SUPER_ADMIN may pass ?companyId; all callers may filter by ?clientId / ?projectId.',
  })
  @RequirePermissions('invoices:read')
  @Get()
  findAll(
    @CurrentUser() actor: CurrentUserPayload,
    @Query('companyId') companyId?: string,
    @Query('clientId') clientId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.invoicesService.findAll(actor, companyId, clientId, projectId);
  }

  @ApiOperation({ summary: 'Get an invoice with its line items and payments.' })
  @RequirePermissions('invoices:read')
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.invoicesService.findOne(id, actor);
  }

  @ApiOperation({
    summary:
      'Update an invoice. Passing lineItems replaces the full set (delete + recreate).',
  })
  @RequirePermissions('invoices:update')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.invoicesService.update(id, dto, actor);
  }

  @ApiOperation({ summary: 'Soft-delete an invoice.' })
  @RequirePermissions('invoices:delete')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() actor: CurrentUserPayload) {
    return this.invoicesService.remove(id, actor);
  }

  @ApiOperation({
    summary:
      'Record a payment against an invoice. Auto-updates status to PARTIAL/PAID.',
  })
  @RequirePermissions('invoices:update')
  @Post(':id/payments')
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.invoicesService.recordPayment(id, dto, actor);
  }

  @ApiOperation({ summary: 'Remove a recorded payment (soft-delete).' })
  @RequirePermissions('invoices:update')
  @Delete(':id/payments/:paymentId')
  removePayment(
    @Param('id') id: string,
    @Param('paymentId') paymentId: string,
    @CurrentUser() actor: CurrentUserPayload,
  ) {
    return this.invoicesService.removePayment(id, paymentId, actor);
  }
}
