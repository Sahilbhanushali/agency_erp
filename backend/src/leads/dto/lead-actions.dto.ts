import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeadActivityType, LeadStatus } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class LogLeadActivityDto {
  @ApiProperty({ enum: LeadActivityType })
  @IsEnum(LeadActivityType)
  type: LeadActivityType;

  @ApiProperty({ example: 'Call went well; sending a proposal Monday.' })
  @IsString()
  @IsNotEmpty()
  note: string;
}

export class ReorderLeadsDto {
  @ApiProperty({ enum: LeadStatus, description: 'Column being reordered.' })
  @IsEnum(LeadStatus)
  status: LeadStatus;

  @ApiProperty({ description: 'Lead ids in their new top-to-bottom order.' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  leadIds: string[];
}

export class ConvertLeadDto {
  @ApiPropertyOptional({
    description:
      'Client name. Defaults to the lead company, or the contact name if there is none.',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Defaults to the lead email.' })
  @IsOptional()
  @IsString()
  email?: string;
}
