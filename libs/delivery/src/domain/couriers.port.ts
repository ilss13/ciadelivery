import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { CourierRecord, CourierStatus } from './courier';

export interface NewCourier {
  id: string;
  tenantId: string;
  storeId: string;
  userId: string;
  name: string;
  phone: string;
  status: CourierStatus;
  active: boolean;
  vehicleType: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourierListQuery {
  page: number;
  pageSize: number;
  active: boolean | null;
  status: CourierStatus | null;
}

export interface Couriers {
  insert(courier: NewCourier, tx: TransactionContext): Promise<void>;
  update(courier: CourierRecord, tx: TransactionContext): Promise<void>;
  findInStore(
    tenantId: string,
    storeId: string,
    courierId: string,
  ): Promise<CourierRecord | null>;
  findByUserId(tenantId: string, userId: string): Promise<CourierRecord | null>;
  lockInStore(
    tenantId: string,
    storeId: string,
    courierId: string,
    tx: TransactionContext,
  ): Promise<CourierRecord | null>;
  list(
    tenantId: string,
    storeId: string,
    query: CourierListQuery,
  ): Promise<{ items: CourierRecord[]; total: number }>;
}

export const COURIERS = Symbol('COURIERS');
