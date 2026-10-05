import { createHmac } from 'node:crypto';
import { DomainException } from '@ciadelivery/shared';
import { CustomerAddressRecord } from './customer';
import { normalizeBrazilPhone } from './phone';

export const ANONYMIZED_CUSTOMER_NAME = 'Cliente anonimizado';

export function anonymizedPhone(phone: string, salt: string): string {
  if (salt.trim().length === 0) {
    throw new DomainException(
      'ANONYMIZATION_UNAVAILABLE',
      'Anonymization is not configured',
      503,
    );
  }
  return createHmac('sha256', salt).update(phone).digest('hex');
}

export function assertPhoneConfirmation(storedPhone: string, typed: string): void {
  const phone = normalizeBrazilPhone(typed);
  if (phone !== storedPhone) {
    throw new DomainException(
      'PHONE_CONFIRMATION_MISMATCH',
      'The phone confirmation does not match',
      409,
    );
  }
}

export function reduceAddressToCity(
  address: CustomerAddressRecord,
): CustomerAddressRecord {
  return {
    ...address,
    label: null,
    line: '',
    number: '',
    complement: null,
    district: '',
    postalCode: '',
    latitude: null,
    longitude: null,
  };
}
