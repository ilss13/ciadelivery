import { OrderAddress } from './order';
import { OrderStatus } from './order-status';

export interface CourierAddressView {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  complement: string | null;
}

export interface CourierTaskSummary {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  totalCents: number;
  address: CourierAddressView | null;
}

export interface CourierTaskDetail extends CourierTaskSummary {
  customerPhone: string;
}

export interface CourierHistoryItem {
  id: string;
  orderNumber: number;
  totalCents: number;
  deliveredAt: Date;
  address: CourierAddressView | null;
}

export function toCourierAddress(
  address: OrderAddress | null,
): CourierAddressView | null {
  if (address === null) {
    return null;
  }
  return {
    line: address.line,
    number: address.number,
    district: address.district,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    complement: address.complement,
  };
}
