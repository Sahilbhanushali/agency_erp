import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * The seam an OAuth callback would post to. Tokens are encrypted before they
 * touch the database and are never returned by any endpoint.
 */
export class StoreCredentialsDto {
  @ApiProperty({ description: 'Platform access token. Stored encrypted.' })
  @IsString()
  @IsNotEmpty()
  accessToken: string;

  @ApiPropertyOptional({ description: 'Stored encrypted.' })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ example: '2026-12-31T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  tokenExpiresAt?: string;

  @ApiPropertyOptional({
    example: ['pages_manage_posts'],
    description: 'Granted scopes, so the UI can say what the token may do.',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  scopes?: string[];
}
