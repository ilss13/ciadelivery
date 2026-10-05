import { DeliveryFeeMode, DeliveryFeeZone } from './delivery-fee';

export interface DeliveryConfigRecord {
  id: string;
  tenantId: string;
  storeId: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  maxRadiusKm: number;
  feeMode: DeliveryFeeMode;
  flatFeeCents: number;
  estimatedMinutes: number;
  originLatitude: number | null;
  originLongitude: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryZoneRecord extends DeliveryFeeZone {
  id: string;
  tenantId: string;
  storeId: string;
}

export interface DeliveryPolicySnapshot {
  config: DeliveryConfigRecord;
  zones: DeliveryZoneRecord[];
}

export interface DeliveryConfigPatch {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  maxRadiusKm: number;
  feeMode: DeliveryFeeMode;
  flatFeeCents: number;
  estimatedMinutes: number;
}

export interface DeliveryOrigin {
  latitude: number;
  longitude: number;
}

export interface DeliveryPolicies {
  find(
    tenantId: string,
    storeId: string,
  ): Promise<DeliveryPolicySnapshot | null>;
  update(input: {
    tenantId: string;
    storeId: string;
    patch: DeliveryConfigPatch;
    zones: DeliveryFeeZone[] | null;
    origin: DeliveryOrigin | null;
  }): Promise<DeliveryPolicySnapshot>;
  replaceZones(
    tenantId: string,
    storeId: string,
    zones: DeliveryFeeZone[],
  ): Promise<DeliveryZoneRecord[]>;
  addZone(
    tenantId: string,
    storeId: string,
    zone: Omit<DeliveryFeeZone, 'sortOrder'>,
  ): Promise<DeliveryZoneRecord>;
  updateZone(
    tenantId: string,
    storeId: string,
    zoneId: string,
    patch: Partial<Omit<DeliveryFeeZone, 'sortOrder'>>,
  ): Promise<DeliveryZoneRecord>;
  deleteZone(tenantId: string, storeId: string, zoneId: string): Promise<void>;
}

export const DELIVERY_POLICIES = Symbol('DELIVERY_POLICIES');
