import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListProjectsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'SUPER_ADMIN only; ignored otherwise.' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ enum: ProjectStatus })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: 'Matches project title or client name.' })
  @IsOptional()
  @IsString()
  search?: string;
}
