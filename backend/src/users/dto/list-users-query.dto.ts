import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'SUPER_ADMIN only; ignored otherwise.' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    description: 'Every term must match a name, email or department.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
