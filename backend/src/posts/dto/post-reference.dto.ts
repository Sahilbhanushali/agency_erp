import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class AddPostReferenceDto {
  @ApiProperty({ example: 'https://www.instagram.com/p/abc123/' })
  @IsUrl({ require_protocol: true }, { message: 'Enter a valid URL' })
  url: string;

  @ApiPropertyOptional({ example: 'Competitor carousel we liked' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
