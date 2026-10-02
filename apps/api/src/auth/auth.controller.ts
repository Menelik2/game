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
    @Body()
    body: {
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
    const result = await this.authService.register(
      {
        ...body,
        email: (body.email || '').trim().toLowerCase(),
      },
      req.ip,
    );
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
    const result = await this.authService.login(
      {
        email: (body.email || '').trim().toLowerCase(),
        password: body.password,
      },
      req.ip,
    );
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
    const secure = this.config.get('COOKIE_SECURE') === true;
    // Clear without domain restriction so host-only cookies are removed
    res.clearCookie('access_token', { path: '/', secure, sameSite: 'lax' });
    res.clearCookie('refresh_token', { path: '/', secure, sameSite: 'lax' });
    return { message: 'Logged out' };
  }

  private setAuthCookies(res: Response, access: string, refresh: string) {
    const secure = this.config.get('COOKIE_SECURE') === true;
    const rawDomain = this.config.get<string>('COOKIE_DOMAIN');
    // Never set Domain=localhost — browsers treat it poorly across ports.
    // Omit domain for local/dev so cookies are host-only.
    const domain =
      rawDomain &&
      rawDomain !== 'localhost' &&
      rawDomain !== '127.0.0.1' &&
      !rawDomain.startsWith('localhost')
        ? rawDomain
        : undefined;

    const base = {
      httpOnly: true,
      secure,
      sameSite: 'lax' as const,
      path: '/',
      ...(domain ? { domain } : {}),
    };

    res.cookie('access_token', access, {
      ...base,
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', refresh, {
      ...base,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
