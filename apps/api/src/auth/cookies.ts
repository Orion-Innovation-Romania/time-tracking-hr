import { Response } from 'express';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

interface CookieOpts {
  secure: boolean;
  accessTtl: number;
  refreshTtl: number;
}

export function setAuthCookies(
  res: Response,
  tokens: { access: string; refresh: string },
  opts: CookieOpts,
): void {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure: opts.secure, path: '/' };
  res.cookie(ACCESS_COOKIE, tokens.access, { ...base, maxAge: opts.accessTtl * 1000 });
  res.cookie(REFRESH_COOKIE, tokens.refresh, { ...base, maxAge: opts.refreshTtl * 1000 });
}

export function clearAuthCookies(res: Response, secure: boolean): void {
  const base = { httpOnly: true, sameSite: 'lax' as const, secure, path: '/' };
  res.clearCookie(ACCESS_COOKIE, base);
  res.clearCookie(REFRESH_COOKIE, base);
}
