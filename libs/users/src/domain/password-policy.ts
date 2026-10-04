import { DomainException } from '@ciadelivery/shared';

const LETTER = /\p{L}/u;
const DIGIT = /\d/;

export function isStrongPassword(password: string): boolean {
  return password.length >= 10 && LETTER.test(password) && DIGIT.test(password);
}

export function assertStrongPassword(password: string): void {
  if (!isStrongPassword(password)) {
    throw new DomainException(
      'WEAK_PASSWORD',
      'The password does not meet the policy',
      400,
    );
  }
}
