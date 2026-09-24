import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { buildMeta, toSkipTake } from '../common/utils/paginate.util';
import { toDateOrUndefined } from '../common/utils/date.util';
import { createWithDocumentNumber } from '../common/utils/document-number.util';
import { computeLineTotals } from '../common/utils/pricing.util';
import {
  assertCompanyAccess,
  resolveTargetCompanyId,
} from '../common/utils/tenant-scope.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { ListQuotationsQueryDto } from './dto/list-quotations-query.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';

const QUOTATION_INCLUDE = {
  lineItems: { orderBy: { position: 'asc' } },
  client: { select: { id: true, name: true, email: true } },
  project: { select: { id: true, title: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class QuotationsService {
  constructor(private readonly prisma: PrismaService) {}

  private latestQuotationNumber(companyId: string, prefix: string) {
    return this.prisma.quotation
      .findFirst({
        where: { companyId, quotationNumber: { startsWith: prefix } },
        orderBy: { quotationNumber: 'desc' },
        select: { quotationNumber: true },
      })
      .then((latest) => latest?.quotationNumber ?? null);
  }

  async create(dto: CreateQuotationDto, actor: CurrentUserPayload) {
    const companyId = resolveTargetCompanyId(dto.companyId, actor);
    await this.assertClientInCompany(dto.clientId, companyId);
    if (dto.projectId)
      await this.assertProjectInCompany(dto.projectId, companyId);

    const discountPercent = dto.discountPercent ?? 0;
    const taxPercent = dto.taxPercent ?? 18;
    const { subTotal, totalAmount } = computeLineTotals(
      dto.lineItems,
      discountPercent,
      taxPercent,
    );
    const prefix = `Q-${new Date().getFullYear()}-`;
    return createWithDocumentNumber({
      prefix,
      findLatestNumber: () => this.latestQuotationNumber(companyId, prefix),
      create: (quotationNumber) =>
        this.prisma.quotation.create({
          data: {
            companyId,
            clientId: dto.clientId,
            projectId: dto.projectId,
            createdById: actor.id,
            quotationNumber,
            title: dto.title,
            description: dto.description,
            currency: dto.currency ?? 'INR',
            discountPercent,
            taxPercent,
            taxType: dto.taxType,
            subTotal,
            totalAmount,
            validUntil: new Date(dto.validUntil),
            terms: dto.terms,
            note: dto.note,
            portalVisible: dto.portalVisible ?? false,
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
          include: QUOTATION_INCLUDE,
        }),
    });
  }

  async findAll(actor: CurrentUserPayload, filters: ListQuotationsQueryDto) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? filters.companyId : actor.companyId;
    const query = filters.search?.trim();
    const where: Prisma.QuotationWhereInput = {
      deletedAt: null,
      ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.projectId ? { projectId: filters.projectId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { quotationNumber: { contains: query } },
              { client: { name: { contains: query } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({
        where,
        include: QUOTATION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return { data, meta: buildMeta(total, filters.page, filters.limit) };
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: QUOTATION_INCLUDE,
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    assertCompanyAccess(quotation.companyId, actor);
    return quotation;
  }

  async update(id: string, dto: UpdateQuotationDto, actor: CurrentUserPayload) {
    const quotation = await this.findOne(id, actor);
    if (dto.projectId)
      await this.assertProjectInCompany(dto.projectId, quotation.companyId);

    const discountPercent =
      dto.discountPercent ?? Number(quotation.discountPercent);
    const taxPercent = dto.taxPercent ?? Number(quotation.taxPercent);
    const lineItems =
      dto.lineItems ??
      quotation.lineItems.map((line) => ({
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
      }));
    const { subTotal, totalAmount } = computeLineTotals(
      lineItems,
      discountPercent,
      taxPercent,
    );

    return this.prisma.$transaction(async (tx) => {
      if (dto.lineItems) {
        await tx.quotationLine.deleteMany({ where: { quotationId: id } });
        await tx.quotationLine.createMany({
          data: dto.lineItems.map((line, index) => ({
            quotationId: id,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            position: index,
          })),
        });
      }

      return tx.quotation.update({
        where: { id },
        data: {
          projectId: dto.projectId,
          title: dto.title,
          description: dto.description,
          currency: dto.currency,
          discountPercent,
          taxPercent,
          taxType: dto.taxType,
          subTotal,
          totalAmount,
          validUntil: toDateOrUndefined(dto.validUntil),
          terms: dto.terms,
          note: dto.note,
          portalVisible: dto.portalVisible,
          signatureUrl: dto.signatureUrl,
          status: dto.status,
          sentAt: dto.status === 'SENT' ? new Date() : undefined,
        },
        include: QUOTATION_INCLUDE,
      });
    });
  }

  async remove(id: string, actor: CurrentUserPayload) {
    await this.findOne(id, actor);
    await this.prisma.quotation.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
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
}
