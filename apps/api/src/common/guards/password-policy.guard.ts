import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { SessionUser } from '@ttah/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_PW_CHANGE_KEY } from '../decorators/allow-password-change.decorator';

/**
 * Blocks every authenticated route while the user still owes a forced password
 * change, except routes explicitly marked @Public() or @AllowWhenMustChange().
 */
@Injectable()
export class PasswordPolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PW_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return true;

    const user = context.switchToHttp().getRequest().user as SessionUser | undefined;
    if (user?.mustChangePassword) {
      throw new ForbiddenException('PASSWORD_CHANGE_REQUIRED');
    }
    return true;
  }
}
