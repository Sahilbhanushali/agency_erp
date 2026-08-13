import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { toDateOrUndefined } from '../common/utils/date.util';
import { computeLineTotals } from '../common/utils/pricing.util';
import {
  assertCompanyAccess,
  resolveTargetCompanyId,
} from '../common/utils/tenant-scope.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';

const INVOICE_INCLUDE = {
  lineItems: { orderBy: { position: 'asc' } },
  payments: { where: { deletedAt: null }, orderBy: { paidAt: 'desc' } },
  client: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, title: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

function withBalance<T extends { totalAmount: unknown; payments: { amount: unknown }[] }>(
  invoice: T,
) {
  const amountPaid = invoice.payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const balanceDue = Math.max(0, Number(invoice.totalAmount) - amountPaid);
  return { ...invoice, amountPaid, balanceDue };
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  private async generateInvoiceNumber(companyId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({
      where: { companyId, invoiceNumber: { startsWith: `INV-${year}-` } },
    });
    return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateInvoiceDto, actor: CurrentUserPayload) {
    const companyId = resolveTargetCompanyId(dto.companyId, actor);
    await this.assertClientInCompany(dto.clientId, companyId);
    if (dto.projectId)
      await this.assertProjectInCompany(dto.projectId, companyId);
    if (dto.quotationId)
      await this.assertQuotationInCompany(dto.quotationId, companyId);

    const discountPercent = dto.discountPercent ?? 0;
    const taxPercent = dto.taxPercent ?? 18;
    const { subTotal, totalAmount } = computeLineTotals(
      dto.lineItems,
      discountPercent,
      taxPercent,
    );
    const invoiceNumber = await this.generateInvoiceNumber(companyId);

    const invoice = await this.prisma.invoice.create({
      data: {
        companyId,
        clientId: dto.clientId,
        projectId: dto.projectId,
        quotationId: dto.quotationId,
        createdById: actor.id,
        invoiceNumber,
        title: dto.title,
        currency: dto.currency ?? 'INR',
        discountPercent,
        taxPercent,
        taxType: dto.taxType,
        subTotal,
        totalAmount,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        terms: dto.terms,
        note: dto.note,
        portalVisible: dto.portalVisible ?? true,
        signatureUrl: dto.signatureUrl,
        lineItems: {
          create: dto.lineItems.map((line, index) => ({
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            position: index,
          })),
        },
      },
      include: INVOICE_INCLUDE,
    });
    return withBalance(invoice);
  }

  async findAll(
    actor: CurrentUserPayload,
    companyId?: string,
    clientId?: string,
    projectId?: string,
  ) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? companyId : actor.companyId;
    const invoices = await this.prisma.invoice.findMany({
      where: {
        deletedAt: null,
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
        ...(clientId ? { clientId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: INVOICE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return invoices.map(withBalance);
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: INVOICE_INCLUDE,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    assertCompanyAccess(invoice.companyId, actor);
    return withBalance(invoice);
  }

  async update(id: string, dto: UpdateInvoiceDto, actor: CurrentUserPayload) {
    const invoice = await this.findOne(id, actor);
    if (dto.projectId)
      await this.assertProjectInCompany(dto.projectId, invoice.companyId);

    const discountPercent = dto.discountPercent ?? Number(invoice.discountPercent);
    const taxPercent = dto.taxPercent ?? Number(invoice.taxPercent);
    const lineItems =
      dto.lineItems ??
      invoice.lineItems.map((line) => ({
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      }));
    const { subTotal, totalAmount } = computeLineTotals(
      lineItems,
      discountPercent,
      taxPercent,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.lineItems) {
        await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
        await tx.invoiceLine.createMany({
          data: dto.lineItems.map((line, index) => ({
            invoiceId: id,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            position: index,
          })),
        });
      }

      return tx.invoice.update({
        where: { id },
        data: {
          projectId: dto.projectId,
          title: dto.title,
          currency: dto.currency,
          discountPercent,
          taxPercent,
          taxType: dto.taxType,
          subTotal,
          totalAmount,
          issueDate: toDateOrUndefined(dto.issueDate),
          dueDate: toDateOrUndefined(dto.dueDate),
          terms: dto.terms,
          note: dto.note,
          portalVisible: dto.portalVisible,
          signatureUrl: dto.signatureUrl,
          status: dto.status,
          sentAt: dto.status === 'SENT' ? new Date() : undefined,
        },
        include: INVOICE_INCLUDE,
      });
    });
    return withBalance(updated);
  }

  async remove(id: string, actor: CurrentUserPayload) {
    await this.findOne(id, actor);
    await this.prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
  }

  async recordPayment(
    invoiceId: string,
    dto: RecordPaymentDto,
    actor: CurrentUserPayload,
  ) {
    const invoice = await this.findOne(invoiceId, actor);

    await this.prisma.payment.create({
      data: {
        invoiceId,
        recordedById: actor.id,
        amount: dto.amount,
        currency: dto.currency ?? invoice.currency,
        method: dto.method,
        transactionRef: dto.transactionRef,
        note: dto.note,
        paidAt: dto.paidAt,
      },
    });

    const refreshed = await this.findOne(invoiceId, actor);
    const nextStatus =
      refreshed.balanceDue <= 0
        ? 'PAID'
        : refreshed.amountPaid > 0
          ? 'PARTIAL'
          : undefined;

    if (nextStatus && !['CANCELLED', 'REFUNDED'].includes(invoice.status)) {
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: nextStatus },
      });
    }

    return this.findOne(invoiceId, actor);
  }

  async removePayment(
    invoiceId: string,
    paymentId: string,
    actor: CurrentUserPayload,
  ) {
    await this.findOne(invoiceId, actor);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, invoiceId, deletedAt: null },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });

    return this.findOne(invoiceId, actor);
  }

  private async assertClientInCompany(clientId: string, companyId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, deletedAt: null },
    });
    if (!client)
      throw new BadRequestException('Client not found in this company');
  }

  private async assertProjectInCompany(projectId: string, companyId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
    });
    if (!project)
      throw new BadRequestException('Project not found in this company');
  }

  private async assertQuotationInCompany(
    quotationId: string,
    companyId: string,
  ) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, companyId, deletedAt: null },
    });
    if (!quotation)
      throw new BadRequestException('Quotation not found in this company');
  }
}
