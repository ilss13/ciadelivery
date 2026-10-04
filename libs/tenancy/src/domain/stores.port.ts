import { TransactionContext } from './transaction-context';

export interface StoreAddress {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface InitialStoreDraft {
  tenantId: string;
  name: string;
  phone: string;
  address: StoreAddress;
}

export interface ProvisionedStore {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  address: StoreAddress;
  latitude: number | null;
  longitude: number | null;
  minimumOrderCents: number;
  isManuallyClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Stores {
  createInitialStore(
    draft: InitialStoreDraft,
    tx: TransactionContext,
  ): Promise<ProvisionedStore>;
  findByTenantId(tenantId: string): Promise<ProvisionedStore | null>;
  findByTenantIds(tenantIds: readonly string[]): Promise<ProvisionedStore[]>;
}

export const STORES = Symbol('STORES');
