import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@agencyos.local' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@12345', minLength: 6 })
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}
