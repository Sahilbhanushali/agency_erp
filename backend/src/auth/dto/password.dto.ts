import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'someone@agency.test' })
  @IsEmail({}, { message: 'Enter a valid email' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'The token from the emailed reset link.' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Proves the session belongs to the account owner.',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}
