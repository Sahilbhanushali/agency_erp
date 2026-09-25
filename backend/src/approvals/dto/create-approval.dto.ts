import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ActivityEntity } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateApprovalDto {
  @ApiProperty({
    enum: ActivityEntity,
    description: 'What needs signing off — content, a quotation, an invoice.',
  })
  @IsEnum(ActivityEntity)
  entity: ActivityEntity;

  @ApiProperty()
  @IsUUID()
  entityId: string;

  @ApiPropertyOptional({
    description:
      'Internal reviewer. Provide this or clientPortalUserId, not both.',
  })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;

  @ApiPropertyOptional({ description: 'Client-side reviewer, via the portal.' })
  @IsOptional()
  @IsUUID()
  clientPortalUserId?: string;

  @ApiProperty({ example: 'Approve the Diwali carousel' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'What the reviewer should look at.' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: '2026-10-18T17:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
