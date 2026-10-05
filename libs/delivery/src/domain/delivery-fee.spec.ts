import { DomainException } from '@ciadelivery/shared';
import {
  assertDeliveryZones,
  haversineKm,
  quoteDeliveryDistance,
  resolveFee,
} from './delivery-fee';

const zones = [
  { fromKm: 0, toKm: 3, feeCents: 500, sortOrder: 0 },
  { fromKm: 3, toKm: 5, feeCents: 700, sortOrder: 1 },
  { fromKm: 5, toKm: 8, feeCents: 1000, sortOrder: 2 },
];

const zoneConfig = {
  maxRadiusKm: 8,
  feeMode: 'ZONE' as const,
  flatFeeCents: 0,
};

describe('delivery distance and zones', () => {
  it('measures a known one-degree separation within 0.05 km', () => {
    const distance = haversineKm(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    );
    expect(Math.abs(distance - (6371 * Math.PI) / 180)).toBeLessThanOrEqual(
      0.05,
    );
  });

  it('charges the band that contains the distance and keeps the outer boundary', () => {
    expect(resolveFee(zoneConfig, zones, 2)).toEqual({
      ok: true,
      feeCents: 500,
    });
    expect(resolveFee(zoneConfig, zones, 3)).toEqual({
      ok: true,
      feeCents: 700,
    });
    expect(resolveFee(zoneConfig, zones, 8)).toEqual({
      ok: true,
      feeCents: 1000,
    });
    expect(resolveFee(zoneConfig, zones, 8.1)).toEqual({
      ok: false,
      reason: 'OUT_OF_AREA',
    });
  });

  it('quotes from explicit coordinates without inventing a missing band', () => {
    const degrees = 2 / ((6371 * Math.PI) / 180);
    const quoted = quoteDeliveryDistance(
      zoneConfig,
      zones,
      { latitude: 0, longitude: 0 },
      { latitude: degrees, longitude: 0 },
    );
    expect(quoted.accepted).toBe(true);
    expect(quoted.feeCents).toBe(500);
    expect(Math.abs(quoted.distanceKm - 2)).toBeLessThanOrEqual(0.05);

    const first = zones[0];
    const last = zones[2];
    if (first === undefined || last === undefined) {
      throw new Error('expected sample zones');
    }
    const gap = resolveFee(zoneConfig, [first, last], 4);
    expect(gap).toEqual({ ok: false, reason: 'DELIVERY_ZONE_NOT_FOUND' });
  });

  it('rejects overlapping bands', () => {
    expect(() =>
      assertDeliveryZones(
        [
          { fromKm: 0, toKm: 4, feeCents: 500, sortOrder: 0 },
          { fromKm: 3, toKm: 8, feeCents: 700, sortOrder: 1 },
        ],
        8,
      ),
    ).toThrow(DomainException);
    try {
      assertDeliveryZones(
        [
          { fromKm: 0, toKm: 4, feeCents: 500, sortOrder: 0 },
          { fromKm: 3, toKm: 8, feeCents: 700, sortOrder: 1 },
        ],
        8,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      expect((error as DomainException).code).toBe('DELIVERY_ZONES_OVERLAP');
    }
  });
});
