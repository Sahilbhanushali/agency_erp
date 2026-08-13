import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaxType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { QuotationLineInputDto } from './quotation-line-input.dto';

export class CreateQuotationDto {
  @ApiProperty({ description: 'Client this quotation is for.' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({ description: 'Project this quotation relates to, if any.' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description:
      'Company to create this quotation in. Required for SUPER_ADMIN; ignored/forced for company-scoped callers.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: 'Q1 Social Media Retainer' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ example: 18, default: 18 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercent?: number;

  @ApiPropertyOptional({ enum: TaxType, default: TaxType.CGST_SGST, description: 'CGST_SGST for intra-state, IGST for inter-state.' })
  @IsOptional()
  @IsEnum(TaxType)
  taxType?: TaxType;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  validUntil: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  portalVisible?: boolean;

  @ApiPropertyOptional({ description: 'Signature image as a base64 data URL.' })
  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @ApiProperty({ type: [QuotationLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuotationLineInputDto)
  lineItems: QuotationLineInputDto[];
}
