import { DomainException } from '@ciadelivery/shared';

const EARTH_RADIUS_KM = 6371;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type DeliveryFeeMode = 'FLAT' | 'ZONE';

export interface DeliveryFeeConfig {
  maxRadiusKm: number;
  feeMode: DeliveryFeeMode;
  flatFeeCents: number;
}

export interface DeliveryFeeZone {
  fromKm: number;
  toKm: number;
  feeCents: number;
  sortOrder: number;
}

export interface DeliveryQuotePolicy extends DeliveryFeeConfig {
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  zones: readonly DeliveryFeeZone[];
}

export type DeliveryFeeFailure = 'OUT_OF_AREA' | 'DELIVERY_ZONE_NOT_FOUND';

export type ResolvedDeliveryFee =
  | { ok: true; feeCents: number }
  | { ok: false; reason: DeliveryFeeFailure };

export interface DeliveryDistanceQuote {
  distanceKm: number;
  feeCents: number;
  accepted: boolean;
  reason: DeliveryFeeFailure | null;
}

export function haversineKm(origin: GeoPoint, destination: GeoPoint): number {
  const latitudeA = toRadians(origin.latitude);
  const latitudeB = toRadians(destination.latitude);
  const deltaLatitude = toRadians(destination.latitude - origin.latitude);
  const deltaLongitude = toRadians(destination.longitude - origin.longitude);
  const sinLatitude = Math.sin(deltaLatitude / 2);
  const sinLongitude = Math.sin(deltaLongitude / 2);
  const chord =
    sinLatitude * sinLatitude +
    Math.cos(latitudeA) * Math.cos(latitudeB) * sinLongitude * sinLongitude;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(chord)));
}

export function resolveFee(
  config: DeliveryFeeConfig,
  zones: readonly DeliveryFeeZone[],
  distanceKm: number,
): ResolvedDeliveryFee {
  if (hundredths(distanceKm) > hundredths(config.maxRadiusKm)) {
    return { ok: false, reason: 'OUT_OF_AREA' };
  }

  if (config.feeMode === 'FLAT') {
    return { ok: true, feeCents: config.flatFeeCents };
  }

  const lastTo = zones.reduce(
    (max, zone) => Math.max(max, hundredths(zone.toKm)),
    Number.NEGATIVE_INFINITY,
  );
  const distance = hundredths(distanceKm);
  for (const zone of zones) {
    const from = hundredths(zone.fromKm);
    const to = hundredths(zone.toKm);
    const includesEnd = to === lastTo;
    const matches = includesEnd
      ? distance >= from && distance <= to
      : distance >= from && distance < to;
    if (matches) {
      return { ok: true, feeCents: zone.feeCents };
    }
  }

  return { ok: false, reason: 'DELIVERY_ZONE_NOT_FOUND' };
}

export function quoteDeliveryDistance(
  config: DeliveryFeeConfig,
  zones: readonly DeliveryFeeZone[],
  origin: GeoPoint,
  destination: GeoPoint,
): DeliveryDistanceQuote {
  const distanceKm = haversineKm(origin, destination);
  const fee = resolveFee(config, zones, distanceKm);
  if (!fee.ok) {
    return {
      distanceKm,
      feeCents: 0,
      accepted: false,
      reason: fee.reason,
    };
  }

  return {
    distanceKm,
    feeCents: fee.feeCents,
    accepted: true,
    reason: null,
  };
}

export function assertDeliveryZones(
  zones: readonly DeliveryFeeZone[],
  maxRadiusKm: number,
): void {
  if (!(maxRadiusKm > 0)) {
    throw invalidZone();
  }

  const radius = hundredths(maxRadiusKm);
  for (const zone of zones) {
    const from = hundredths(zone.fromKm);
    const to = hundredths(zone.toKm);
    if (
      !Number.isFinite(zone.fromKm) ||
      !Number.isFinite(zone.toKm) ||
      from < 0 ||
      from >= to ||
      to > radius ||
      !Number.isInteger(zone.feeCents) ||
      zone.feeCents < 0
    ) {
      throw invalidZone();
    }
  }

  const ordered = [...zones].sort(
    (left, right) =>
      hundredths(left.fromKm) - hundredths(right.fromKm) ||
      left.sortOrder - right.sortOrder,
  );
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    if (previous === undefined || current === undefined) {
      continue;
    }
    if (hundredths(current.fromKm) < hundredths(previous.toKm)) {
      throw new DomainException(
        'DELIVERY_ZONES_OVERLAP',
        'The delivery zones overlap',
        422,
      );
    }
  }
}

function invalidZone(): DomainException {
  return new DomainException(
    'DELIVERY_ZONE_INVALID',
    'The delivery zone is invalid',
    422,
  );
}

function hundredths(kilometers: number): number {
  return Math.round(kilometers * 100);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
