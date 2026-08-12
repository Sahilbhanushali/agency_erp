import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'Bright Bakery' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'contact@brightbakery.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description:
      'Company to create this client in. Required for SUPER_ADMIN; ignored/forced for company-scoped callers.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ example: 'Food & Beverage' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: 'https://brightbakery.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '+91 9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  panNumber?: string;

  @ApiPropertyOptional({
    description: 'Employee who manages this client account.',
  })
  @IsOptional()
  @IsUUID()
  accountManagerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
