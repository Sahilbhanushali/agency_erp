import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';

export class ReorderTasksDto {
  @ApiProperty({
    enum: TaskStatus,
    description: 'Status column the cards now belong to.',
  })
  @IsEnum(TaskStatus)
  status: TaskStatus;

  @ApiProperty({
    type: [String],
    description: 'Every task in that column, in its new top-to-bottom order.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  taskIds: string[];
}
