import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { Request } from 'express';
import { resolveRoles } from '../rbac/roles';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.access_token,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    isAdmin?: boolean;
    roles?: string[];
  }) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user || user.status === 'SUSPENDED' || user.status === 'CLOSED') {
      throw new UnauthorizedException();
    }
    const roles = resolveRoles({
      isAdmin: user.isAdmin,
      adminRoles: user.adminRoles,
    });
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      isAdmin: user.isAdmin || roles.some((r) => r !== 'USER'),
      roles,
    };
  }
}
