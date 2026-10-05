import { STUB_GEOCODING_ORIGIN, STUB_OUTSIDE_POSTAL_CODE } from './geocoding-provider';
import { StubGeocodingProvider, stubCoordinateForPostalCode } from './stub-geocoding';

describe('StubGeocodingProvider', () => {
  it('maps a postal code to a stable point near the demo origin', () => {
    const first = stubCoordinateForPostalCode('01001-000');
    const second = stubCoordinateForPostalCode('01001000');
    expect(second).toEqual(first);
    expect(Math.abs(first.latitude - STUB_GEOCODING_ORIGIN.latitude)).toBeLessThanOrEqual(
      0.018,
    );
    expect(
      Math.abs(first.longitude - STUB_GEOCODING_ORIGIN.longitude),
    ).toBeLessThanOrEqual(0.018);
  });

  it('places the documented outside postal code well away from the demo origin', () => {
    const outside = stubCoordinateForPostalCode(STUB_OUTSIDE_POSTAL_CODE);
    expect(outside.latitude - STUB_GEOCODING_ORIGIN.latitude).toBeCloseTo(0.2, 5);
    expect(outside.longitude).toBe(STUB_GEOCODING_ORIGIN.longitude);
  });

  it('uses an in-memory override and reports a miss', async () => {
    const provider = new StubGeocodingProvider();
    const address = {
      line: 'Rua A',
      number: '10',
      district: 'Centro',
      city: 'Sao Paulo',
      state: 'SP',
      postalCode: '01001000',
      complement: null,
    };
    const point = { latitude: -23.53, longitude: -46.63 };
    provider.register(address, point);
    await expect(provider.geocode(address)).resolves.toEqual(point);
    provider.register(address, null);
    await expect(provider.geocode(address)).rejects.toMatchObject({
      code: 'ADDRESS_NOT_FOUND',
      statusCode: 422,
    });
  });
});
