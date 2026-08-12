import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertBankDetailDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  @IsNotEmpty()
  accountHolderName: string;

  @ApiProperty({ example: '000123456789' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({ example: 'HDFC Bank' })
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @ApiProperty({ example: 'HDFC0001234' })
  @IsString()
  @IsNotEmpty()
  ifscCode: string;

  @ApiPropertyOptional({ example: 'MG Road Branch' })
  @IsOptional()
  @IsString()
  branchName?: string;
}
