import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({
    description:
      'Project the task belongs to. The task inherits its company from this project.',
  })
  @IsUUID()
  projectId: string;

  @ApiPropertyOptional({
    description:
      'Workspace board inside the project. Omit to leave the task in the project backlog.',
  })
  @IsOptional()
  @IsUUID()
  workspaceId?: string | null;

  @ApiProperty({ example: 'Draft the March content calendar' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    example: '2026-04-15',
    description: 'null clears it.',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({
    description: 'Employee responsible for the task. null unassigns.',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({ description: 'Sort order within its status column.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}

/** A sub-task is a Task that takes its project, workspace and company from its parent. */
export class CreateSubTaskDto extends PickType(CreateTaskDto, [
  'title',
  'assigneeId',
  'dueDate',
] as const) {}
