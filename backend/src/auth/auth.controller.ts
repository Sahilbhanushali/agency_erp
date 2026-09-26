import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  CurrentUser,
  type CurrentUserPayload,
} from './decorators/current-user.decorator';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { LoginDto } from './dto/login.dto';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({
    summary:
      'Log in with email + password. Shared by admin, employee and client-portal users.',
  })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.requestMeta(req));
  }

  @ApiOperation({
    summary:
      "Accept an invite: set the account's password using the token emailed on creation, and activate it.",
  })
  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  acceptInvite(@Body() dto: AcceptInviteDto, @Req() req: Request) {
    return this.authService.acceptInvite(dto, this.requestMeta(req));
  }

  @ApiOperation({
    summary:
      'Exchange a valid refresh token for a new access + refresh token pair (rotates the old one).',
  })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, this.requestMeta(req));
  }

  @ApiOperation({ summary: 'Revoke a refresh token, ending that session.' })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiOperation({
    summary:
      'Return the current authenticated user (sanity check for the access token).',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: CurrentUserPayload) {
    return user;
  }

  private requestMeta(req: Request) {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }

  @ApiOperation({
    summary:
      'Start a password reset. Always succeeds, so it cannot be used to discover which emails exist.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @ApiOperation({
    summary:
      'Set a new password using an emailed token. Signs out every existing session.',
  })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiOperation({
    summary:
      'Change your own password. Requires the current one and ends other sessions.',
  })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch('change-password')
  changePassword(
    @CurrentUser() actor: CurrentUserPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(actor.id, dto);
  }
}
