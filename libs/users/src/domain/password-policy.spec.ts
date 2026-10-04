import { DomainException } from '@ciadelivery/shared';
import { assertStrongPassword, isStrongPassword } from './password-policy';

describe('password policy', () => {
  it('requires at least 10 characters, one letter and one number', () => {
    expect(isStrongPassword('abc1234567')).toBe(true);
    expect(isStrongPassword('Ábcdefghi1')).toBe(true);
    expect(isStrongPassword('abcdefghij')).toBe(false);
    expect(isStrongPassword('1234567890')).toBe(false);
    expect(isStrongPassword('abc123')).toBe(false);
  });

  it('rejects a weak password with WEAK_PASSWORD', () => {
    expect(() => assertStrongPassword('abcdefghij')).toThrow(DomainException);
    try {
      assertStrongPassword('short');
    } catch (error) {
      expect(error).toMatchObject({ code: 'WEAK_PASSWORD', statusCode: 400 });
    }
  });
});
