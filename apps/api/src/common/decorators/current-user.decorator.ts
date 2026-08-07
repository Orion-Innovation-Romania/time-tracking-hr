import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionUser } from '@ttah/shared';

/** Injects the authenticated user (populated by JwtStrategy) into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as SessionUser;
  },
);
