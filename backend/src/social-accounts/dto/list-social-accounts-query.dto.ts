import { ApiPropertyOptional } from '@nestjs/swagger';
import { SocialPlatform } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListSocialAccountsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'SUPER_ADMIN only; ignored otherwise.' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ enum: SocialPlatform })
  @IsOptional()
  @IsEnum(SocialPlatform)
  platform?: SocialPlatform;

  @ApiPropertyOptional({ description: 'Matches account name or handle.' })
  @IsOptional()
  @IsString()
  search?: string;
}
