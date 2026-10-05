import { createHash } from 'node:crypto';
import { DomainException } from '../http/domain-exception';
import {
  AddressInput,
  AddressResult,
  Coordinates,
  GeocodingProvider,
  STUB_GEOCODING_ORIGIN,
  STUB_OUTSIDE_POSTAL_CODE,
} from './geocoding-provider';

const BOX_DEGREES = 0.018;

export class StubGeocodingProvider implements GeocodingProvider {
  private readonly overrides = new Map<string, Coordinates | null>();

  register(address: AddressInput, coordinates: Coordinates | null): void {
    this.overrides.set(addressKey(address), coordinates);
  }

  clear(): void {
    this.overrides.clear();
  }

  geocode(address: AddressInput): Promise<Coordinates> {
    const override = this.overrides.get(addressKey(address));
    if (override === null) {
      return Promise.reject(addressNotFound());
    }
    if (override !== undefined) {
      return Promise.resolve(override);
    }

    return Promise.resolve(stubCoordinateForPostalCode(address.postalCode));
  }

  reverseGeocode(coords: Coordinates): Promise<AddressResult> {
    void coords.latitude;
    return Promise.resolve({
      line: 'Endereço aproximado',
      number: 'S/N',
      district: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      postalCode: '01001000',
      complement: null,
    });
  }
}

export function isStubGeocoding(
  provider: GeocodingProvider,
): provider is StubGeocodingProvider {
  return provider instanceof StubGeocodingProvider;
}

export function stubCoordinateForPostalCode(postalCode: string): Coordinates {
  const digits = postalDigits(postalCode);
  if (digits === STUB_OUTSIDE_POSTAL_CODE) {
    return {
      latitude: round6(STUB_GEOCODING_ORIGIN.latitude + 0.2),
      longitude: STUB_GEOCODING_ORIGIN.longitude,
    };
  }

  const hash = createHash('sha256').update(digits).digest();
  const latitudeOffset = ((byte(hash, 0) / 255) * 2 - 1) * BOX_DEGREES;
  const longitudeOffset = ((byte(hash, 1) / 255) * 2 - 1) * BOX_DEGREES;
  return {
    latitude: round6(STUB_GEOCODING_ORIGIN.latitude + latitudeOffset),
    longitude: round6(STUB_GEOCODING_ORIGIN.longitude + longitudeOffset),
  };
}

function addressKey(address: AddressInput): string {
  return [
    address.line.trim().toLowerCase(),
    address.number.trim().toLowerCase(),
    address.district.trim().toLowerCase(),
    address.city.trim().toLowerCase(),
    address.state.trim().toUpperCase(),
    postalDigits(address.postalCode),
    (address.complement ?? '').trim().toLowerCase(),
  ].join('|');
}

function postalDigits(postalCode: string): string {
  const digits = postalCode.replace(/\D/g, '');
  return digits.length > 0 ? digits : '0';
}

function byte(hash: Buffer, index: number): number {
  return hash[index] ?? 0;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function addressNotFound(): DomainException {
  return new DomainException(
    'ADDRESS_NOT_FOUND',
    'The address was not found',
    422,
  );
}
