import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { InvoiceLineInputDto } from './invoice-line-input.dto';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Client this invoice is billed to.' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({ description: 'Project this invoice relates to, if any.' })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({ description: 'The quotation this invoice was raised from, if any.' })
  @IsOptional()
  @IsUUID()
  quotationId?: string;

  @ApiPropertyOptional({
    description:
      'Company to create this invoice in. Required for SUPER_ADMIN; ignored/forced for company-scoped callers.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ example: 'Q1 Social Media Retainer — March' })
  @IsString()
  @IsNotEmpty()
  title: string;

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

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  issueDate: string;

  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  terms?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  portalVisible?: boolean;

  @ApiPropertyOptional({ description: 'Signature image as a base64 data URL.' })
  @IsOptional()
  @IsString()
  signatureUrl?: string;

  @ApiProperty({ type: [InvoiceLineInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineInputDto)
  lineItems: InvoiceLineInputDto[];
}
