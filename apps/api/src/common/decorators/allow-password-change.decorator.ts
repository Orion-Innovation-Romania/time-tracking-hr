import { SetMetadata } from '@nestjs/common';

export const ALLOW_PW_CHANGE_KEY = 'allowWhenMustChange';

/**
 * Allows a route to be used even when the user still has a pending forced
 * password change (e.g. /auth/me, /auth/change-password, /auth/logout).
 */
export const AllowWhenMustChange = () => SetMetadata(ALLOW_PW_CHANGE_KEY, true);
