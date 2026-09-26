import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { generateToken, hashToken } from '../common/utils/token.util';
import { MailerService } from '../mailer/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { LoginDto } from './dto/login.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password.dto';

/** Short-lived on purpose: a reset link is a bearer credential sitting in an inbox. */
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        `Account is ${user.status.toLowerCase()}`,
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokenPair(
      user.id,
      user.companyId,
      user.roleId,
      meta,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        companyId: user.companyId,
        roleId: user.roleId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    };
  }

  async acceptInvite(dto: AcceptInviteDto, meta: RequestMeta) {
    const tokenHash = hashToken(dto.token);
    const user = await this.prisma.user.findUnique({
      where: { inviteTokenHash: tokenHash },
    });

    if (
      !user ||
      user.deletedAt ||
      !user.inviteTokenExpiresAt ||
      user.inviteTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Invite link is invalid or expired');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        inviteTokenHash: null,
        inviteTokenExpiresAt: null,
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.issueTokenPair(
      user.id,
      user.companyId,
      user.roleId,
      meta,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        companyId: user.companyId,
        roleId: user.roleId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const payload = await this.verifyRefreshToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });
    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt < new Date()
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid or expired session');
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user.id, user.companyId, user.roleId, meta);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<{ sub: string }> {
    try {
      return await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  /**
   * Always resolves the same way, whether or not the address exists. Telling a
   * caller "no such user" would turn this into a way to enumerate accounts.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const settled = {
      message:
        'If that email belongs to an account, a reset link is on its way.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || user.deletedAt || user.status === 'SUSPENDED') return settled;

    const { token, tokenHash } = generateToken();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetTokenExpiresAt: new Date(
          Date.now() + PASSWORD_RESET_TTL_MS,
        ),
      },
    });

    try {
      const origin = this.configService
        .getOrThrow<string>('FRONTEND_ORIGIN')
        .split(',')[0];
      await this.mailerService.sendPasswordResetEmail(
        user.email,
        user.firstName,
        `${origin}/auth/reset-password?token=${token}`,
      );
    } catch (error) {
      // Still reports success: the response must not differ based on mail delivery.
      this.logger.error(
        `Password reset email to ${user.email} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }

    return settled;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = hashToken(dto.token);
    const user = await this.prisma.user.findUnique({
      where: { passwordResetTokenHash: tokenHash },
    });

    if (
      !user ||
      user.deletedAt ||
      !user.passwordResetTokenExpiresAt ||
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      throw new UnauthorizedException('Reset link is invalid or expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(dto.password, 10),
          passwordResetTokenHash: null,
          passwordResetTokenExpiresAt: null,
          // An invited user who resets instead of accepting is still verified.
          status: user.status === 'INVITED' ? 'ACTIVE' : user.status,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      }),
      // Whoever knew the old password is logged out everywhere.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password updated. Sign in with your new password.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.deletedAt) throw new UnauthorizedException();

    const matches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!matches) {
      throw new BadRequestException('Your current password is not correct.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'The new password must differ from the current one.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      message: 'Password changed. Other sessions have been signed out.',
    };
  }

  private async issueTokenPair(
    userId: string,
    companyId: string | null,
    roleId: string,
    meta: RequestMeta,
  ) {
    const payload = { sub: userId, companyId, roleId };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.getOrThrow<string>(
        'JWT_ACCESS_EXPIRES_IN',
      ) as JwtSignOptions['expiresIn'],
    });

    const refreshExpiresIn = this.configService.getOrThrow<string>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    // jti makes every issued refresh token unique — without it, two tokens signed for the
    // same user within the same second are byte-identical and collide on the DB unique index.
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, jti: randomUUID() },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn as JwtSignOptions['expiresIn'],
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(
          Date.now() + this.parseExpiresInMs(refreshExpiresIn),
        ),
      },
    });

    return { accessToken, refreshToken };
  }

  private parseExpiresInMs(expiresIn: string): number {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    if (!match) return 7 * 24 * 60 * 60 * 1000;

    const value = Number(match[1]);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[
      match[2]
    ]!;
    return value * unitMs;
  }
}
