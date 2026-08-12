import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import {
  assertCompanyAccess,
  resolveTargetCompanyId,
} from '../common/utils/tenant-scope.util';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddressInputDto } from '../common/dto/address-input.dto';
import { CreateSkillDto } from './dto/create-skill.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpsertBankDetailDto } from './dto/upsert-bank-detail.dto';
import { UpsertEmployeeProfileDto } from './dto/upsert-employee-profile.dto';

const USER_INCLUDE = {
  omit: { passwordHash: true },
  include: {
    role: true,
    employeeProfile: {
      include: {
        bankDetail: true,
        skills: true,
        currentAddress: true,
        permanentAddress: true,
      },
    },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  async create(dto: CreateUserDto, actor: CurrentUserPayload) {
    const companyId = resolveTargetCompanyId(dto.companyId, actor);

    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, companyId, deletedAt: null },
    });
    if (!role) throw new BadRequestException('Role not found in this company');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        companyId,
        roleId: dto.roleId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth,
        employmentType: dto.employmentType,
        department: dto.department,
        designation: dto.designation,
        joiningDate: dto.joiningDate,
        isRemote: dto.isRemote,
      },
      ...USER_INCLUDE,
    });
  }

  findAll(actor: CurrentUserPayload, companyId?: string) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? companyId : actor.companyId;
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      },
      ...USER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      ...USER_INCLUDE,
    });
    if (!user) throw new NotFoundException('User not found');
    assertCompanyAccess(user.companyId, actor);
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actor: CurrentUserPayload) {
    const user = await this.findOne(id, actor);

    if (dto.roleId && dto.roleId !== user.roleId) {
      const role = await this.prisma.role.findFirst({
        where: { id: dto.roleId, companyId: user.companyId, deletedAt: null },
      });
      if (!role)
        throw new BadRequestException('Role not found in this company');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        roleId: dto.roleId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        gender: dto.gender,
        dateOfBirth: dto.dateOfBirth,
        employmentType: dto.employmentType,
        department: dto.department,
        designation: dto.designation,
        joiningDate: dto.joiningDate,
        isRemote: dto.isRemote,
        status: dto.status,
      },
      ...USER_INCLUDE,
    });
  }

  async remove(id: string, actor: CurrentUserPayload) {
    await this.findOne(id, actor);
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
  }

  async upsertProfile(
    userId: string,
    dto: UpsertEmployeeProfileDto,
    actor: CurrentUserPayload,
  ) {
    const user = await this.findOne(userId, actor);
    const { currentAddress, permanentAddress, ...profileFields } = dto;

    const currentAddressId = currentAddress
      ? await this.upsertAddress(
          user.employeeProfile?.currentAddressId,
          currentAddress,
        )
      : undefined;
    const permanentAddressId = permanentAddress
      ? await this.upsertAddress(
          user.employeeProfile?.permanentAddressId,
          permanentAddress,
        )
      : undefined;

    return this.prisma.employeeProfile.upsert({
      where: { userId },
      create: {
        userId,
        ...profileFields,
        currentAddressId,
        permanentAddressId,
      },
      update: {
        ...profileFields,
        ...(currentAddressId && { currentAddressId }),
        ...(permanentAddressId && { permanentAddressId }),
      },
      include: {
        bankDetail: true,
        skills: true,
        currentAddress: true,
        permanentAddress: true,
      },
    });
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

  async upsertBankDetail(
    userId: string,
    dto: UpsertBankDetailDto,
    actor: CurrentUserPayload,
  ) {
    const user = await this.findOne(userId, actor);
    if (!user.employeeProfile)
      throw new BadRequestException(
        'Create the employee profile before adding bank details',
      );

    return this.prisma.employeeBankDetail.upsert({
      where: { employeeProfileId: user.employeeProfile.id },
      create: { employeeProfileId: user.employeeProfile.id, ...dto },
      update: dto,
    });
  }

  async addSkill(
    userId: string,
    dto: CreateSkillDto,
    actor: CurrentUserPayload,
  ) {
    const user = await this.findOne(userId, actor);
    if (!user.employeeProfile)
      throw new BadRequestException(
        'Create the employee profile before adding skills',
      );

    return this.prisma.employeeSkill.create({
      data: { employeeProfileId: user.employeeProfile.id, ...dto },
    });
  }

  async removeSkill(
    userId: string,
    skillId: string,
    actor: CurrentUserPayload,
  ) {
    const user = await this.findOne(userId, actor);
    const skill = await this.prisma.employeeSkill.findFirst({
      where: { id: skillId, employeeProfileId: user.employeeProfile?.id },
    });
    if (!skill) throw new NotFoundException('Skill not found');
    await this.prisma.employeeSkill.delete({ where: { id: skillId } });
  }

  async addDocument(
    userId: string,
    file: Express.Multer.File,
    dto: UploadDocumentDto,
    actor: CurrentUserPayload,
  ) {
    const user = await this.findOne(userId, actor);

    const savedFile = await this.filesService.save(
      user.companyId!,
      actor.id,
      file,
      'employee-documents',
    );

    return this.prisma.document.create({
      data: {
        companyId: user.companyId!,
        fileId: savedFile.id,
        employeeUserId: userId,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        isClientVisible: dto.isClientVisible,
      },
      include: { file: true },
    });
  }

  async listDocuments(userId: string, actor: CurrentUserPayload) {
    await this.findOne(userId, actor);
    return this.prisma.document.findMany({
      where: { employeeUserId: userId, deletedAt: null },
      include: { file: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeDocument(
    userId: string,
    documentId: string,
    actor: CurrentUserPayload,
  ) {
    await this.findOne(userId, actor);
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, employeeUserId: userId, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Document not found');

    await this.filesService.remove(document.fileId, actor.id);
    await this.prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date(), deletedBy: actor.id },
    });
  }
}
