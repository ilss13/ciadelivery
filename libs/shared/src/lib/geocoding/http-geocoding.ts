import { DomainException } from '../http/domain-exception';
import {
  AddressInput,
  AddressResult,
  Coordinates,
  GeocodingProvider,
} from './geocoding-provider';

const DEFAULT_TIMEOUT_MS = 3000;

export class HttpGeocodingProvider implements GeocodingProvider {
  constructor(
    private readonly endpoint: string,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  geocode(address: AddressInput): Promise<Coordinates> {
    const url = new URL(this.endpoint);
    url.searchParams.set('line', address.line);
    url.searchParams.set('number', address.number);
    url.searchParams.set('district', address.district);
    url.searchParams.set('city', address.city);
    url.searchParams.set('state', address.state);
    url.searchParams.set('postalCode', address.postalCode);
    if (address.complement !== undefined && address.complement !== null) {
      url.searchParams.set('complement', address.complement);
    }
    return this.getJson(url).then(readCoordinates);
  }

  reverseGeocode(coords: Coordinates): Promise<AddressResult> {
    const url = new URL(this.endpoint);
    url.searchParams.set('latitude', String(coords.latitude));
    url.searchParams.set('longitude', String(coords.longitude));
    return this.getJson(url).then(readAddress);
  }

  private async getJson(url: URL): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw unavailable();
    }

    if (response.status === 404 || response.status === 204) {
      throw addressNotFound();
    }
    if (!response.ok) {
      throw unavailable();
    }

    try {
      return await response.json();
    } catch {
      throw unavailable();
    }
  }
}

function readCoordinates(body: unknown): Coordinates {
  if (body === null || typeof body !== 'object') {
    throw addressNotFound();
  }
  const record = body as { latitude?: unknown; longitude?: unknown };
  if (!isCoordinate(record.latitude) || !isCoordinate(record.longitude)) {
    throw addressNotFound();
  }
  return { latitude: record.latitude, longitude: record.longitude };
}

function readAddress(body: unknown): AddressResult {
  if (body === null || typeof body !== 'object') {
    throw addressNotFound();
  }
  const record = body as Record<string, unknown>;
  const line = text(record['line']);
  const number = text(record['number']);
  const district = text(record['district']);
  const city = text(record['city']);
  const state = text(record['state']);
  const postalCode = text(record['postalCode']);
  if (
    line === null ||
    number === null ||
    district === null ||
    city === null ||
    state === null ||
    postalCode === null
  ) {
    throw addressNotFound();
  }
  const complement = record['complement'];
  return {
    line,
    number,
    district,
    city,
    state,
    postalCode,
    complement: typeof complement === 'string' ? complement : null,
  };
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function isCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function addressNotFound(): DomainException {
  return new DomainException(
    'ADDRESS_NOT_FOUND',
    'The address was not found',
    422,
  );
}

function unavailable(): DomainException {
  return new DomainException(
    'GEOCODING_UNAVAILABLE',
    'Geocoding is unavailable',
    503,
  );
}
