import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSocialAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountType?: string;

  @ApiPropertyOptional({
    description: 'Switching this off reports the account as DISCONNECTED.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
