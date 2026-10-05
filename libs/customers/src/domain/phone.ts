import { DomainException } from '@ciadelivery/shared';

const BRAZIL_PHONE = /^55\d{10,11}$/;

export function normalizeBrazilPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  const withCountry =
    digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (!BRAZIL_PHONE.test(withCountry)) {
    throw new DomainException(
      'INVALID_PHONE',
      'The phone number is invalid',
      400,
    );
  }

  return withCountry;
}
