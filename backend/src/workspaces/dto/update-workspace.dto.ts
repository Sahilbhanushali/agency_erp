import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateWorkspaceDto } from './create-workspace.dto';

export class UpdateWorkspaceDto extends PartialType(
  OmitType(CreateWorkspaceDto, ['projectId'] as const),
) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
