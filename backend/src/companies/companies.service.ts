import { Injectable, NotFoundException } from '@nestjs/common';
import type { AddressInputDto } from '../common/dto/address-input.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCompanyDto) {
    const { registeredAddress, ...companyFields } = dto;
    const registeredAddressId = registeredAddress
      ? (await this.prisma.address.create({ data: registeredAddress })).id
      : undefined;

    return this.prisma.company.create({
      data: { ...companyFields, registeredAddressId },
      include: { registeredAddress: true },
    });
  }

  findAll() {
    return this.prisma.company.findMany({
      where: { deletedAt: null },
      include: { registeredAddress: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: { registeredAddress: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  private async upsertAddress(
    existingAddressId: string | null | undefined,
    data: AddressInputDto,
  ) {
    if (existingAddressId) {
      const updated = await this.prisma.address.update({
        where: { id: existingAddressId },
        data,
      });
      return updated.id;
    }
    const created = await this.prisma.address.create({ data });
    return created.id;
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.findOne(id);
    const { registeredAddress, ...companyFields } = dto;

    const registeredAddressId = registeredAddress
      ? await this.upsertAddress(company.registeredAddressId, registeredAddress)
      : undefined;

    return this.prisma.company.update({
      where: { id },
      data: {
        ...companyFields,
        ...(registeredAddressId && { registeredAddressId }),
      },
      include: { registeredAddress: true },
    });
  }

  async remove(id: string, deletedBy: string) {
    await this.findOne(id);
    await this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy, isActive: false },
    });
  }
}
