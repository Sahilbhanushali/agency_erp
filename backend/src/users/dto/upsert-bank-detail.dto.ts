import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class UpsertBankDetailDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  accountHolderName: string;

  @ApiProperty({ example: '000123456789' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{6,20}$/, {
    message: 'accountNumber must be 6-20 digits',
  })
  accountNumber: string;

  @ApiProperty({ example: 'HDFC Bank' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ example: 'HDFC0001234' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, {
    message: 'ifscCode must be a valid 11-character IFSC code',
  })
  ifscCode: string;

  @ApiPropertyOptional({ example: 'MG Road Branch' })
  @IsOptional()
  @IsString()
  branchName?: string;
}
