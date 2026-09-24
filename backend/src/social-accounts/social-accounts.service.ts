import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SocialAccount } from '@prisma/client';
import type { CurrentUserPayload } from '../auth/decorators/current-user.decorator';
import { encryptSecret } from '../common/utils/crypto.util';
import {
  buildMeta,
  searchFilter,
  toSkipTake,
} from '../common/utils/paginate.util';
import {
  assertCompanyAccess,
  resolveTargetCompanyId,
} from '../common/utils/tenant-scope.util';
import { PrismaService } from '../prisma/prisma.service';
import { connectionState } from './connection-state';
import { CreateSocialAccountDto } from './dto/create-social-account.dto';
import { ListSocialAccountsQueryDto } from './dto/list-social-accounts-query.dto';
import { StoreCredentialsDto } from './dto/store-credentials.dto';
import { UpdateSocialAccountDto } from './dto/update-social-account.dto';
import { SocialProviderRegistry } from './providers/social-provider';

type AccountWithRelations = SocialAccount & {
  client?: { id: string; name: string } | null;
  scopes?: { scope: string }[];
};

@Injectable()
export class SocialAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: SocialProviderRegistry,
  ) {}

  /**
   * The single exit point for an account. Tokens are dropped here rather than in
   * each query, so a new endpoint cannot leak them by forgetting a select.
   */
  /**
   * The single exit point for an account, and an allowlist rather than a strip:
   * a secret column added to the model later cannot leak by being forgotten here.
   */
  private present(account: AccountWithRelations) {
    return {
      id: account.id,
      companyId: account.companyId,
      clientId: account.clientId,
      platform: account.platform,
      externalId: account.externalId,
      accountName: account.accountName,
      accountType: account.accountType,
      isActive: account.isActive,
      tokenExpiresAt: account.tokenExpiresAt,
      lastSyncedAt: account.lastSyncedAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      client: account.client ?? null,
      connectionState: connectionState(account),
      /** False when the platform has no provider registered in this deployment. */
      publishingAvailable: this.providers.supports(account.platform),
      scopes: account.scopes?.map((entry) => entry.scope) ?? [],
    };
  }

  async create(dto: CreateSocialAccountDto, actor: CurrentUserPayload) {
    const companyId = resolveTargetCompanyId(dto.companyId, actor);
    await this.assertClientInCompany(dto.clientId, companyId);

    const duplicate = await this.prisma.socialAccount.findFirst({
      where: {
        clientId: dto.clientId,
        platform: dto.platform,
        externalId: dto.externalId,
        deletedAt: null,
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'That profile is already registered for this client.',
      );
    }

    const account = await this.prisma.socialAccount.create({
      data: {
        companyId,
        clientId: dto.clientId,
        platform: dto.platform,
        externalId: dto.externalId,
        accountName: dto.accountName,
        accountType: dto.accountType,
        // Registering is not connecting; credentials arrive separately.
        accessToken: '',
      },
      include: { client: { select: { id: true, name: true } }, scopes: true },
    });

    return this.present(account);
  }

  async findAll(
    actor: CurrentUserPayload,
    filters: ListSocialAccountsQueryDto,
  ) {
    const scopedCompanyId =
      actor.roleName === 'SUPER_ADMIN' ? filters.companyId : actor.companyId;
    const where: Prisma.SocialAccountWhereInput = {
      deletedAt: null,
      ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.platform ? { platform: filters.platform } : {}),
      ...searchFilter(filters.search, ['accountName', 'externalId']),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.socialAccount.findMany({
        where,
        include: {
          client: { select: { id: true, name: true } },
          scopes: true,
        },
        orderBy: [{ platform: 'asc' }, { accountName: 'asc' }],
        ...toSkipTake(filters.page, filters.limit),
      }),
      this.prisma.socialAccount.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.present(row)),
      meta: buildMeta(total, filters.page, filters.limit),
    };
  }

  async findOne(id: string, actor: CurrentUserPayload) {
    return this.present(await this.loadRaw(id, actor));
  }

  async update(
    id: string,
    dto: UpdateSocialAccountDto,
    actor: CurrentUserPayload,
  ) {
    await this.loadRaw(id, actor);
    const account = await this.prisma.socialAccount.update({
      where: { id },
      data: {
        accountName: dto.accountName,
        accountType: dto.accountType,
        isActive: dto.isActive,
      },
      include: { client: { select: { id: true, name: true } }, scopes: true },
    });
    return this.present(account);
  }

  /** Where an OAuth callback hands over its tokens. */
  async storeCredentials(
    id: string,
    dto: StoreCredentialsDto,
    actor: CurrentUserPayload,
  ) {
    await this.loadRaw(id, actor);

    const account = await this.prisma.$transaction(async (tx) => {
      await tx.socialAccountScope.deleteMany({
        where: { socialAccountId: id },
      });
      if (dto.scopes?.length) {
        await tx.socialAccountScope.createMany({
          data: dto.scopes.map((scope) => ({ socialAccountId: id, scope })),
        });
      }
      return tx.socialAccount.update({
        where: { id },
        data: {
          accessToken: encryptSecret(dto.accessToken),
          refreshToken: dto.refreshToken
            ? encryptSecret(dto.refreshToken)
            : null,
          tokenExpiresAt: dto.tokenExpiresAt
            ? new Date(dto.tokenExpiresAt)
            : null,
          isActive: true,
          lastSyncedAt: new Date(),
        },
        include: { client: { select: { id: true, name: true } }, scopes: true },
      });
    });

    return this.present(account);
  }

  /** Clears credentials without losing the account record or its history. */
  async revokeCredentials(id: string, actor: CurrentUserPayload) {
    await this.loadRaw(id, actor);

    const account = await this.prisma.$transaction(async (tx) => {
      await tx.socialAccountScope.deleteMany({
        where: { socialAccountId: id },
      });
      return tx.socialAccount.update({
        where: { id },
        data: {
          accessToken: '',
          refreshToken: null,
          tokenExpiresAt: null,
          isActive: false,
        },
        include: { client: { select: { id: true, name: true } }, scopes: true },
      });
    });

    return this.present(account);
  }

  async remove(id: string, actor: CurrentUserPayload) {
    const account = await this.loadRaw(id, actor);

    const pending = await this.prisma.postTarget.count({
      where: {
        socialAccountId: account.id,
        status: { in: ['PENDING', 'SCHEDULED', 'PUBLISHING'] },
      },
    });
    if (pending > 0) {
      throw new BadRequestException(
        `${pending} scheduled post${pending === 1 ? '' : 's'} still target this account. Remove them first.`,
      );
    }

    await this.prisma.socialAccount.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: actor.id, accessToken: '' },
    });
  }

  /** Internal: the only place the raw row (with ciphertext) is handled. */
  async loadRaw(id: string, actor: CurrentUserPayload) {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, deletedAt: null },
      include: { client: { select: { id: true, name: true } }, scopes: true },
    });
    if (!account) throw new NotFoundException('Social account not found');
    assertCompanyAccess(account.companyId, actor);
    return account;
  }

  private async assertClientInCompany(clientId: string, companyId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, companyId, deletedAt: null },
    });
    if (!client)
      throw new BadRequestException('Client not found in this company');
  }
}
