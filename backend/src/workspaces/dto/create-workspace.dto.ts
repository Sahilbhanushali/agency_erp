import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateWorkspaceDto {
  @ApiProperty({ description: 'Project this workspace belongs to.' })
  @IsUUID()
  projectId: string;

  @ApiProperty({ example: 'Content Creation' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#22C55E' })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;
}
