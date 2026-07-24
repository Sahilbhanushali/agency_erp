import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description:
      'The refresh token issued at login or from a previous refresh call.',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
