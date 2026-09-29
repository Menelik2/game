import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new player (demo mode auto-activates)' })
  async register(
    @Body() body: {
      email: string;
      password: string;
      dateOfBirth: string;
      country: string;
      acceptTerms: boolean;
      acceptAge: boolean;
    },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(body, req.ip);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login' })
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body, req.ip);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return { message: 'Logged out' };
  }

  private setAuthCookies(res: Response, access: string, refresh: string) {
    const secure = this.config.get('COOKIE_SECURE') === true;
    const domain = this.config.get('COOKIE_DOMAIN');

    res.cookie('access_token', access, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      domain,
    });
    res.cookie('refresh_token', refresh, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      domain,
    });
  }
}
