import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MINUTES = 60;

const TOKEN_BYTES = 32;

export function generatePasswordResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(TOKEN_BYTES).toString('hex');
  return { raw, hash: hashPasswordResetToken(raw) };
}

export function hashPasswordResetToken(raw: string): string {
  return createHash('sha256').update(raw.trim().toLowerCase()).digest('hex');
}

export function passwordResetHashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
