export interface CourierAddress {
  line: string;
  number: string;
  district: string;
  city: string;
  state: string;
  postalCode: string;
  complement: string | null;
}

export interface CourierOrder {
  id: string;
  orderNumber: number;
  status: string;
  totalCents: number;
  address: CourierAddress | null;
  customerPhone?: string;
}

export interface CourierRealtimeEvent {
  event: string;
  orderId: string;
  status: string;
  orderNumber: number;
  occurredAt: string;
}

export function formatAddress(address: CourierAddress | null): string {
  if (address === null) {
    return 'Endereço não informado';
  }
  const complement =
    address.complement === null || address.complement.length === 0
      ? ''
      : `, ${address.complement}`;
  return `${address.line}, ${address.number}${complement} — ${address.district}, ${address.city}`;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function applyCourierEvent(
  orders: readonly CourierOrder[],
  event: CourierRealtimeEvent,
  fetched: CourierOrder | null,
): CourierOrder[] {
  if (event.event === 'order.delivered') {
    return orders.filter((order) => order.id !== event.orderId);
  }
  const current = orders.find((order) => order.id === event.orderId) ?? fetched;
  if (current === null) {
    return [...orders];
  }
  const next: CourierOrder = {
    ...current,
    status: event.status,
    orderNumber: event.orderNumber,
  };
  const rest = orders.filter((order) => order.id !== event.orderId);
  if (event.status === 'DELIVERED') {
    return rest;
  }
  return [next, ...rest];
}
