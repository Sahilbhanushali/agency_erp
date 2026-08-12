import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UploadDocumentDto {
  @ApiProperty({ example: 'Aadhaar Card' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: DocumentCategory,
    default: DocumentCategory.OTHER,
  })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the client can see this document.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isClientVisible?: boolean;
}
