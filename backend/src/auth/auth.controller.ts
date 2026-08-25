import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from './entities/authenticated-user.entity.js';
import { JwtAuthGuard } from './strategies/jwt-auth.guard.js';
import { CurrentUser } from './decorator/current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken: unknown = request.cookies?.refreshToken;
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      throw new UnauthorizedException('Không tìm thấy refresh token');
    }

    const result = await this.authService.refresh(refreshToken);
    this.setRefreshTokenCookie(response, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken: unknown = request.cookies?.refreshToken;
    if (typeof refreshToken === 'string') {
      await this.authService.logout(refreshToken);
    }

    this.clearRefreshTokenCookie(response);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  private clearRefreshTokenCookie(response: Response) {
    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
    });
  }

  private setRefreshTokenCookie(response: Response, refreshToken: string) {
    const maxAge = Number(
      this.configService.getOrThrow<string>('JWT_REFRESH_COOKIE_MAX_AGE_MS'),
    );

    response.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/api/v1/auth',
    });
  }
}
