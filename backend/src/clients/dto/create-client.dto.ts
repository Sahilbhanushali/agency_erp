import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
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
  @Matches(/^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}([/?#]\S*)?$/i, {
    message: 'website must be a valid URL',
  })
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'phone must be a valid 10-digit number' })
  phone?: string;

  @ApiPropertyOptional({ example: '22AAAAA0000A1Z5' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]$/, {
    message: 'gstNumber must be a valid 15-character GSTIN',
  })
  gstNumber?: string;

  @ApiPropertyOptional({ example: 'AAAAA0000A' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, {
    message: 'panNumber must be a valid 10-character PAN',
  })
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
