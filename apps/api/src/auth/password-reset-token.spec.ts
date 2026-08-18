import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  passwordResetHashesEqual,
} from './password-reset-token';

describe('password-reset-token', () => {
  it('hashes the same raw token consistently and case-insensitively', () => {
    const { raw, hash } = generatePasswordResetToken();
    expect(raw).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPasswordResetToken(raw)).toBe(hash);
    expect(hashPasswordResetToken(raw.toUpperCase())).toBe(hash);
  });

  it('compares hashes in constant time', () => {
    const { hash } = generatePasswordResetToken();
    expect(passwordResetHashesEqual(hash, hash)).toBe(true);
    expect(passwordResetHashesEqual(hash, '0'.repeat(hash.length))).toBe(false);
  });
});
