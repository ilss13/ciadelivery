export interface StoreAddress {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface StoreRecord {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  address: StoreAddress;
  latitude: number | null;
  longitude: number | null;
  minimumOrderCents: number;
  isManuallyClosed: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  deliveryFlatFeeCents: number;
  estimatedPrepMinutes: number;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoreProfileUpdate {
  name: string;
  phone: string;
  address: StoreAddress;
  minimumOrderCents: number;
  isManuallyClosed: boolean;
}

export interface StoreSettings {
  id: string;
  name: string;
  phone: string;
  address: StoreAddress;
  minimumOrderCents: number;
  isManuallyClosed: boolean;
  timezone: string;
}

export interface CurrentStore {
  findForCurrentTenant(): Promise<StoreRecord | null>;
  updateForCurrentTenant(patch: StoreProfileUpdate): Promise<StoreRecord>;
}

export const CURRENT_STORE = Symbol('CURRENT_STORE');

export function toStoreSettings(store: StoreRecord): StoreSettings {
  return {
    id: store.id,
    name: store.name,
    phone: store.phone,
    address: store.address,
    minimumOrderCents: store.minimumOrderCents,
    isManuallyClosed: store.isManuallyClosed,
    timezone: store.timezone,
  };
}
