import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { AddressInputDto } from '../../common/dto/address-input.dto';

export class CreateCompanyDto {
  @ApiProperty({ example: 'Acme Marketing' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Acme Marketing Pvt Ltd' })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiPropertyOptional({ description: 'Logo image as a base64 data URL.' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ example: 'contact@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'phone must be a valid 10-digit number' })
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}([/?#]\S*)?$/i, {
    message: 'website must be a valid URL',
  })
  website?: string;

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

  @ApiPropertyOptional({ example: '998314 | 998391', description: 'HSN/SAC code(s) shown on quotations and invoices.' })
  @IsOptional()
  @IsString()
  hsnNumber?: string;

  @ApiPropertyOptional({ example: 'TJSB Bank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ example: 'Acme Marketing Pvt Ltd' })
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiPropertyOptional({ example: '155120100000086' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6,20}$/, { message: 'bankAccountNumber must be 6-20 digits' })
  bankAccountNumber?: string;

  @ApiPropertyOptional({ example: 'TJSB0000155' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, {
    message: 'bankIfsc must be a valid 11-character IFSC code',
  })
  bankIfsc?: string;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 'Asia/Kolkata', default: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ type: AddressInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressInputDto)
  registeredAddress?: AddressInputDto;
}
