import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTaskCommentDto {
  @ApiProperty({ example: 'First draft is ready for review.' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
