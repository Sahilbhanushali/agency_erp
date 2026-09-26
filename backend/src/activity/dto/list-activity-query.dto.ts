import { ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityAction, ActivityEntity } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListActivityQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'SUPER_ADMIN only; ignored otherwise.' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: ActivityEntity })
  @IsOptional()
  @IsEnum(ActivityEntity)
  entity?: ActivityEntity;

  @ApiPropertyOptional({ description: 'Timeline for one record.' })
  @IsOptional()
  @IsUUID()
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: ActivityAction })
  @IsOptional()
  @IsEnum(ActivityAction)
  action?: ActivityAction;
}
