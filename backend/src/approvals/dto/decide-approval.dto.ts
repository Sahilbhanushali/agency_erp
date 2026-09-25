import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalDecisionType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class DecideApprovalDto {
  @ApiProperty({
    enum: ApprovalDecisionType,
    description: 'COMMENT leaves the request open; the rest close it.',
  })
  @IsEnum(ApprovalDecisionType)
  decision: ApprovalDecisionType;

  @ApiPropertyOptional({
    description:
      'Required when asking for changes, so there is something to act on.',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
