import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { Role, SessionUser } from '@ttah/shared';
import type { JwtConfig } from '../config/configuration';
import { UsersService } from '../users/users.service';
import { ACCESS_COOKIE } from './cookies';

interface AccessPayload {
  sub: number;
  username: string;
  role: Role;
  typ: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly users: UsersService) {
    const jwt = config.get<JwtConfig>('jwt')!;
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.[ACCESS_COOKIE] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: jwt.accessSecret,
    });
  }

  async validate(payload: AccessPayload): Promise<SessionUser> {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException();
    }
    const user = await this.users.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
