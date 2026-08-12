import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtAccessPayload {
  sub: string;
  companyId: string | null;
  roleId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtAccessPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    if (!user || user.deletedAt || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return {
      id: user.id,
      companyId: user.companyId,
      roleId: user.roleId,
      roleName: user.role.name,
      email: user.email,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
    };
  }
}
