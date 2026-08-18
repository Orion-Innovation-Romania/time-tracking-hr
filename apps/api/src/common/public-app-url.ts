import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/** Browser origin for links in emails. Prefer PUBLIC_APP_URL / CORS_ORIGIN, then forwarded host. */
export function resolvePublicAppUrl(config: ConfigService, req: Request): string {
  const configured = config.get<string>('publicAppUrl') ?? '';
  if (configured) return configured.replace(/\/+$/, '');

  const header = (name: string) => {
    const raw = req.headers[name];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' ? value.split(',')[0]?.trim() : '';
  };
  const host = header('x-forwarded-host') || header('host');
  if (!host) return '';
  const proto = header('x-forwarded-proto') || req.protocol || 'https';
  return `${proto}://${host}`.replace(/\/+$/, '');
}
