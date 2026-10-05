import { AddressInput, GeocodingProvider } from '@ciadelivery/shared';
import { DeliveryPolicySnapshot } from '../domain/delivery-policy';
import { quoteFulfillment } from './quote-fulfillment';

const address: AddressInput = {
  line: 'Rua A',
  number: '10',
  district: 'Centro',
  city: 'Sao Paulo',
  state: 'SP',
  postalCode: '01001000',
  complement: null,
};

describe('quoteFulfillment', () => {
  it('charges the zone fee from the haversine distance and skips geocoding on pickup', async () => {
    const geocoding = fake({ latitude: -23.532534, longitude: -46.633308 });
    const quoted = await quoteFulfillment(geocoding.provider, {
      fulfillment: 'DELIVERY',
      policy: policy(),
      address,
    });
    expect(quoted.accepted).toBe(true);
    expect(quoted.feeCents).toBe(500);
    expect(quoted.distanceKm).toBeGreaterThan(1.5);
    expect(quoted.distanceKm).toBeLessThan(2.5);
    expect(quoted.estimatedMinutes).toBe(40);
    expect(quoted.latitude).toBe(-23.532534);

    const pickup = await quoteFulfillment(geocoding.provider, {
      fulfillment: 'PICKUP',
      policy: policy(),
      address,
    });
    expect(pickup).toEqual({
      fulfillment: 'PICKUP',
      accepted: true,
      distanceKm: null,
      feeCents: 0,
      estimatedMinutes: 40,
      reason: null,
      latitude: null,
      longitude: null,
    });
    expect(geocoding.calls).toBe(1);
  });

  it('rejects a destination outside the radius without inventing a fee', async () => {
    const geocoding = fake({ latitude: 0, longitude: 0 });
    const quoted = await quoteFulfillment(geocoding.provider, {
      fulfillment: 'DELIVERY',
      policy: policy(),
      address,
    });
    expect(quoted.accepted).toBe(false);
    expect(quoted.reason).toBe('OUT_OF_AREA');
    expect(quoted.feeCents).toBe(0);
  });

  it('refuses to quote delivery when the store has no origin', async () => {
    const current = policy();
    current.config.originLatitude = null;
    current.config.originLongitude = null;
    await expect(
      quoteFulfillment(fake({ latitude: 0, longitude: 0 }).provider, {
        fulfillment: 'DELIVERY',
        policy: current,
        address,
      }),
    ).rejects.toMatchObject({ code: 'STORE_ORIGIN_MISSING', statusCode: 422 });
  });
});

function policy(): DeliveryPolicySnapshot {
  return {
    config: {
      id: 'config',
      tenantId: 'tenant',
      storeId: 'store',
      deliveryEnabled: true,
      pickupEnabled: true,
      maxRadiusKm: 8,
      feeMode: 'ZONE',
      flatFeeCents: 0,
      estimatedMinutes: 40,
      originLatitude: -23.55052,
      originLongitude: -46.633308,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    zones: [
      {
        id: 'near',
        tenantId: 'tenant',
        storeId: 'store',
        fromKm: 0,
        toKm: 3,
        feeCents: 500,
        sortOrder: 0,
      },
      {
        id: 'far',
        tenantId: 'tenant',
        storeId: 'store',
        fromKm: 3,
        toKm: 8,
        feeCents: 1000,
        sortOrder: 1,
      },
    ],
  };
}

function fake(point: { latitude: number; longitude: number }): {
  provider: GeocodingProvider;
  calls: number;
} {
  const state = { calls: 0 };
  return {
    provider: {
      geocode: () => {
        state.calls += 1;
        return Promise.resolve(point);
      },
      reverseGeocode: () => Promise.reject(new Error('unused')),
    },
    get calls() {
      return state.calls;
    },
  };
}
