import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WorkspaceMemberRole } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({
    description: 'User to add to the workspace (must be in the same company).',
  })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({
    enum: WorkspaceMemberRole,
    default: WorkspaceMemberRole.MEMBER,
  })
  @IsOptional()
  @IsEnum(WorkspaceMemberRole)
  memberRole?: WorkspaceMemberRole;
}
