import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateRoleDto {
  @ApiPropertyOptional({
    description: 'Required for SUPER_ADMIN to target a company.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: 'CONTENT_MANAGER' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'name must be uppercase letters, numbers and underscores only (e.g. CONTENT_MANAGER)',
  })
  name: string;

  @ApiProperty({ example: 'Content Manager' })
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  permissionIds: string[];
}
