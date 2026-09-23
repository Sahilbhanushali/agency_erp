import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { QuotationStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateQuotationDto } from './create-quotation.dto';

export class UpdateQuotationDto extends PartialType(
  OmitType(CreateQuotationDto, ['companyId', 'clientId'] as const),
) {
  @ApiPropertyOptional({ enum: QuotationStatus })
  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;
}
