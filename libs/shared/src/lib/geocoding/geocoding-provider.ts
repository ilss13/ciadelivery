export interface AddressInput {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  complement?: string | null;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface AddressResult {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  complement: string | null;
}

export interface GeocodingProvider {
  geocode(address: AddressInput): Promise<Coordinates>;
  reverseGeocode(coords: Coordinates): Promise<AddressResult>;
}

export const GEOCODING = Symbol('GEOCODING');

export const STUB_GEOCODING_ORIGIN: Coordinates = {
  latitude: -23.55052,
  longitude: -46.633308,
};

export const STUB_OUTSIDE_POSTAL_CODE = '99999999';
