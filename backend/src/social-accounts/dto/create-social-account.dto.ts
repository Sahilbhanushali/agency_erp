import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SocialPlatform } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateSocialAccountDto {
  @ApiPropertyOptional({ description: 'SUPER_ADMIN only.' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ description: 'Client that owns this profile.' })
  @IsUUID()
  clientId: string;

  @ApiProperty({ enum: SocialPlatform })
  @IsEnum(SocialPlatform)
  platform: SocialPlatform;

  @ApiProperty({
    example: '@kairorealty',
    description:
      'Handle or platform profile id. Registering an account does not connect it.',
  })
  @IsString()
  @IsNotEmpty()
  externalId: string;

  @ApiProperty({ example: 'Kairo Realty — Instagram' })
  @IsString()
  @IsNotEmpty()
  accountName: string;

  @ApiPropertyOptional({ example: 'BUSINESS' })
  @IsOptional()
  @IsString()
  accountType?: string;
}
