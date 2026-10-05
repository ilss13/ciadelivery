import {
  ANONYMIZED_CUSTOMER_NAME,
  anonymizedPhone,
  assertPhoneConfirmation,
  reduceAddressToCity,
} from './anonymize';
import { CustomerAddressRecord } from './customer';

describe('customer anonymization', () => {
  it('hashes the phone with the application salt and keeps it irreversible', () => {
    const phone = '5511988887777';
    const hashed = anonymizedPhone(phone, 'app-salt');
    expect(hashed).toHaveLength(64);
    expect(hashed).not.toContain('88887777');
    expect(anonymizedPhone(phone, 'app-salt')).toBe(hashed);
    expect(anonymizedPhone(phone, 'other-salt')).not.toBe(hashed);
    expect(ANONYMIZED_CUSTOMER_NAME).toBe('Cliente anonimizado');
  });

  it('rejects a confirmation that is not the stored phone', () => {
    expect(() => assertPhoneConfirmation('5511988887777', '11988887777')).not.toThrow();
    expect(() => assertPhoneConfirmation('5511988887777', '11977776666')).toThrow(
      'The phone confirmation does not match',
    );
  });

  it('keeps only the city on an address', () => {
    const address: CustomerAddressRecord = {
      id: 'address-1',
      tenantId: 'tenant-1',
      customerId: 'customer-1',
      label: 'Casa',
      line: 'Rua A',
      number: '10',
      complement: 'ap 2',
      district: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01001000',
      latitude: -23.5,
      longitude: -46.6,
      createdAt: new Date('2026-10-05T12:00:00.000Z'),
    };
    expect(reduceAddressToCity(address)).toEqual({
      ...address,
      label: null,
      line: '',
      number: '',
      complement: null,
      district: '',
      postalCode: '',
      latitude: null,
      longitude: null,
    });
  });
});