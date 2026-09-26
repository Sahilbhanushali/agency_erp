import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { Prisma, UserStatus } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { buildMeta, toSkipTake } from '../common/utils/paginate.util';
import {
  assertCompanyAccess,
  resolveTargetCompanyId,
} from '../common/utils/tenant-scope.util';
import { toDateOrUndefined } from '../common/utils/date.util';
import { generateToken } from '../common/utils/token.util';
import { FilesService } from '../files/files.service';
import { MailerService } from '../mailer/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { AddressInputDto } from '../common/dto/address-input.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { CreateSkillDto } from './dto/create-skill.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpsertBankDetailDto } from './dto/upsert-bank-detail.dto';
import { UpsertEmployeeProfileDto } from './dto/upsert-employee-profile.dto';

const INVITE_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

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
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateUserDto, actor: CurrentUserPayload) {
    const companyId = resolveTargetCompanyId(dto.companyId, actor);

    const role = await this.prisma.role.findFirst({
      where: { id: dto.roleId, companyId, deletedAt: null },
    });
    if (!role) throw new BadRequestException('Role not found in this company');

    const clash = await this.findEmailOwner(dto.email);
    this.assertEmailAvailable(clash, companyId);

    // Unusable placeholder — the account is unlocked via the invite link, which sets a real password.
    const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
    const { token, tokenHash } = generateToken();

    const data = {
      companyId,
      roleId: dto.roleId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      inviteTokenHash: tokenHash,
      inviteTokenExpiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
      gender: dto.gender,
      dateOfBirth: toDateOrUndefined(dto.dateOfBirth),
      employmentType: dto.employmentType,
      department: dto.department,
      designation: dto.designation,
      joiningDate: toDateOrUndefined(dto.joiningDate),
      isRemote: dto.isRemote,
    };

    /**
     * Email is unique across the whole install and a removed user keeps its row, so
     * re-inviting someone who was removed has to revive that row. Creating a second
     * one is impossible, and refusing would leave the address unusable forever.
     */
    const user = clash
      ? await this.prisma.user.update({
          where: { id: clash.id },
          data: {
            ...data,
            status: UserStatus.INVITED,
            deletedAt: null,
            deletedBy: null,
          },
          ...USER_INCLUDE,
        })
      : await this.prisma.user.create({ data, ...USER_INCLUDE });

    // The member is already saved, so a mail problem must not fail the request and
    // leave a row nobody knows about. It is reported instead, and can be resent.
    const inviteEmailSent = await this.sendInvite(
      user.email,
      user.firstName,
      token,
    );

    return { ...user, inviteEmailSent };
  }

  /** Issues a fresh invite for someone whose first one never arrived. */
  async resendInvite(id: string, actor: CurrentUserPayload) {
    const user = await this.findOne(id, actor);
    if (user.status !== UserStatus.INVITED) {
      throw new BadRequestException(
        'That user has already accepted their invite.',
      );
    }

    const { token, tokenHash } = generateToken();
    await this.prisma.user.update({
      where: { id },
      data: {
        inviteTokenHash: tokenHash,
        inviteTokenExpiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
      },
    });

    const inviteEmailSent = await this.sendInvite(
      user.email,
      user.firstName,
      token,
    );
    if (!inviteEmailSent) {
      throw new ServiceUnavailableException(
        'Could not send the invite email. Check the mail settings and try again.',
      );
    }
    return { inviteEmailSent };
  }

  /** Resolves false rather than throwing, so callers decide how much a failure matters. */
  private async sendInvite(email: string, firstName: string, token: string) {
    try {
      const frontendOrigin = this.configService
        .getOrThrow<string>('FRONTEND_ORIGIN')
        .split(',')[0];
      await this.mailerService.sendInviteEmail(
        email,
        firstName,
        `${frontendOrigin}/auth/accept-invite?token=${token}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Invite email to ${email} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return false;
    }
  }

  private findEmailOwner(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        companyId: true,
        deletedAt: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  private assertEmailAvailable(
    owner: {
      companyId: string | null;
      deletedAt: Date | null;
      firstName: string;
      lastName: string;
    } | null,
    companyId: string,
  ) {
    if (!owner) return;

    if (!owner.deletedAt) {
      throw new ConflictException(
        owner.companyId === companyId
          ? `${owner.firstName} ${owner.lastName} already uses that email in this company.`
          : 'That email address already belongs to a user in another company.',
      );
    }
    if (owner.companyId !== companyId) {
      throw new ConflictException(
        'That email belonged to a removed user in another company. Email addresses are unique across companies, so use a different address.',
      );
    }
    // Same company, previously removed: the caller is re-inviting them, which is allowed.
  }

  async findAll(actor: CurrentUserPayload, filters: ListUsersQueryDto) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? filters.companyId : actor.companyId;
    const query = filters.search?.trim();
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      // Each term must hit some field, so "Jane Doe" still matches a split first/last name.
      ...(query
        ? {
            AND: query.split(/\s+/).map((term) => ({
              OR: [
                { firstName: { contains: term } },
                { lastName: { contains: term } },
                { email: { contains: term } },
                { department: { contains: term } },
              ],
            })),
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        ...USER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data, meta: buildMeta(total, filters.page, filters.limit) };
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
        dateOfBirth: toDateOrUndefined(dto.dateOfBirth),
        employmentType: dto.employmentType,
        department: dto.department,
        designation: dto.designation,
        joiningDate: toDateOrUndefined(dto.joiningDate),
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

  async getDocumentFile(
    userId: string,
    documentId: string,
    actor: CurrentUserPayload,
  ) {
    await this.findOne(userId, actor);
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, employeeUserId: userId, deletedAt: null },
    });
    if (!document) throw new NotFoundException('Document not found');

    return this.filesService.getAbsolutePath(document.fileId);
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
