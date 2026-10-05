import { TransactionContext } from '@ciadelivery/tenancy/domain';
import { CustomerScope } from './customer';

export interface ExportedOrderItem {
  id: string;
  productName: string;
  sku: string | null;
  unitPriceCents: number;
  quantity: number;
  notes: string | null;
  options: unknown[];
  subtotalCents: number;
}

export interface ExportedOrderAddress {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  complement: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ExportedOrder {
  id: string;
  orderNumber: number;
  status: string;
  fulfillment: string;
  customerName: string;
  customerPhone: string;
  address: ExportedOrderAddress | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  notes: string | null;
  createdAt: Date;
  items: ExportedOrderItem[];
}

export interface CustomerOrders {
  list(scope: CustomerScope, customerId: string): Promise<ExportedOrder[]>;
  anonymize(
    scope: CustomerScope,
    customerId: string,
    name: string,
    phone: string,
    tx: TransactionContext,
  ): Promise<void>;
}

export const CUSTOMER_ORDERS = Symbol('CUSTOMER_ORDERS');
