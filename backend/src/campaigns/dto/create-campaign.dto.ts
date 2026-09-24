import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CampaignObjective, CampaignStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateCampaignDto {
  @ApiPropertyOptional({
    description: 'SUPER_ADMIN only; everyone else uses their own company.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ description: 'Client this campaign runs for.' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({
    description: 'Project the campaign is delivered under.',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @ApiProperty({ example: 'Diwali Always-On — Instagram' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: CampaignObjective,
    default: CampaignObjective.AWARENESS,
  })
  @IsOptional()
  @IsEnum(CampaignObjective)
  objective?: CampaignObjective;

  @ApiPropertyOptional({ enum: CampaignStatus, default: CampaignStatus.DRAFT })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({ example: 250000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget?: number;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-11-15' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
