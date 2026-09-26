import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadSource, LeadStatus, TaskPriority } from '@prisma/client';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateLeadDto {
  @ApiPropertyOptional({ description: 'SUPER_ADMIN only.' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: 'Meera Raghavan' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Orbit Interiors' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: 'meera@orbitinteriors.test' })
  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email' })
  email?: string;

  @ApiPropertyOptional({ example: '+91 98200 11223' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: LeadSource, default: LeadSource.OTHER })
  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @ApiPropertyOptional({ example: 'Interior Design' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: 180000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedValue?: number;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: LeadStatus, default: LeadStatus.NEW })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Salesperson working the lead.' })
  @IsOptional()
  @IsUUID()
  ownerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2026-10-02T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  nextFollowUpAt?: string | null;

  @ApiPropertyOptional({ description: 'Required when moving a lead to LOST.' })
  @IsOptional()
  @IsString()
  lostReason?: string;
}
