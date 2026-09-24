import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliverableType, PostStatus, PostType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePostDto {
  @ApiPropertyOptional({
    description: 'SUPER_ADMIN only; everyone else uses their own company.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiProperty({ description: 'Client the content belongs to.' })
  @IsUUID()
  clientId: string;

  @ApiPropertyOptional({ description: 'Campaign this content runs under.' })
  @IsOptional()
  @IsUUID()
  campaignId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string | null;

  @ApiPropertyOptional({ description: 'Workspace board this content sits on.' })
  @IsOptional()
  @IsUUID()
  workspaceId?: string | null;

  @ApiProperty({ example: 'Diwali carousel — 5 slides' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'The caption as it will be published.' })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiPropertyOptional({ enum: PostType, default: PostType.STATIC })
  @IsOptional()
  @IsEnum(PostType)
  postType?: PostType;

  @ApiPropertyOptional({ enum: DeliverableType })
  @IsOptional()
  @IsEnum(DeliverableType)
  deliverableType?: DeliverableType | null;

  @ApiPropertyOptional({
    enum: PostStatus,
    default: PostStatus.IDEA,
    description: 'New content may only start at IDEA or DRAFT.',
  })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiPropertyOptional({
    example: '2026-10-21T09:30:00.000Z',
    description: 'Required before a post can move to SCHEDULED.',
  })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string | null;

  @ApiPropertyOptional({ description: 'Person responsible for producing it.' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;
}
