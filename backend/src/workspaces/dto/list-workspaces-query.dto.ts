import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListWorkspacesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'SUPER_ADMIN only; ignored otherwise.' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Matches workspace name.' })
  @IsOptional()
  @IsString()
  search?: string;
}
