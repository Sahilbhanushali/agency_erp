import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, Gender } from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'jane.doe@acme.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+91 9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Jane@12345', minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description:
      'Role to assign to the user (must belong to the same company).',
  })
  @IsUUID()
  roleId: string;

  @ApiPropertyOptional({
    description:
      'Company to create this user in. Required for SUPER_ADMIN; ignored/forced for company-scoped callers.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ example: '1995-06-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: EmploymentType })
  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @ApiPropertyOptional({ example: 'Marketing' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'Social Media Executive' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isRemote?: boolean;
}
