import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsHexColor,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Bright Bakery — Q1 Social Campaign' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description:
      'Client this project belongs to (must be in the same company).',
  })
  @IsUUID()
  clientId: string;

  @ApiProperty({
    description:
      'Employee managing this project (must be in the same company).',
  })
  @IsUUID()
  managerId: string;

  @ApiPropertyOptional({
    description:
      'Company to create this project in. Required for SUPER_ADMIN; ignored/forced for company-scoped callers.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.DRAFT })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({ example: '2026-02-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  clientApprovalEnabled?: boolean;

  @ApiPropertyOptional({ example: '#4F46E5' })
  @IsOptional()
  @IsHexColor()
  colorHex?: string;
}
