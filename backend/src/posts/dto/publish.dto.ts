import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class AddPostTargetDto {
  @ApiProperty({ description: 'Connected profile to publish to.' })
  @IsUUID()
  socialAccountId: string;

  @ApiPropertyOptional({
    description: 'Overrides the post schedule for this destination.',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class MarkPublishedDto {
  @ApiProperty({
    example: '18023456789012345',
    description:
      'The post id or URL on the platform. Required: it is the evidence that this actually went live.',
  })
  @IsString()
  @IsNotEmpty()
  platformPostId: string;

  @ApiPropertyOptional({ example: '2026-10-21T09:32:00.000Z' })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
