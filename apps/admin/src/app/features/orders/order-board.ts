export interface OrderCard {
  id: string;
  orderNumber: number;
  createdAt: string;
  totalCents: number;
  status: string;
  fulfillment: string;
  customerName: string;
  source: string;
  notes: string | null;
}

export function isTestOrder(order: OrderCard): boolean {
  return order.source === 'TEST' || order.notes === 'TEST_ORDER';
}

export interface OrderRealtimeEvent {
  event: string;
  orderId: string;
  status: string;
  orderNumber: number;
  occurredAt: string;
}

export interface BoardColumn {
  id: string;
  title: string;
  statuses: readonly string[];
  empty: string;
}

export const OPEN_ORDER_STATUSES = [
  'NEW',
  'ACCEPTED',
  'IN_PREPARATION',
  'READY',
  'OUT_FOR_DELIVERY',
] as const;

export const FINISHED_ORDER_STATUSES = [
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
] as const;

export const BOARD_COLUMNS: readonly BoardColumn[] = [
  {
    id: 'new',
    title: 'Novos',
    statuses: ['NEW'],
    empty: 'Nenhum pedido novo',
  },
  {
    id: 'accepted',
    title: 'Aceitos',
    statuses: ['ACCEPTED'],
    empty: 'Nenhum pedido aceito',
  },
  {
    id: 'preparing',
    title: 'Em preparo',
    statuses: ['IN_PREPARATION'],
    empty: 'Nenhum pedido em preparo',
  },
  {
    id: 'ready',
    title: 'Prontos',
    statuses: ['READY'],
    empty: 'Nenhum pedido pronto',
  },
  {
    id: 'delivery',
    title: 'Saiu para entrega',
    statuses: ['OUT_FOR_DELIVERY'],
    empty: 'Nenhum pedido em entrega',
  },
  {
    id: 'done',
    title: 'Finalizados',
    statuses: [...FINISHED_ORDER_STATUSES],
    empty: 'Nenhum pedido finalizado hoje',
  },
];

const OPEN = new Set<string>(OPEN_ORDER_STATUSES);
const FINISHED = new Set<string>(FINISHED_ORDER_STATUSES);

export function localDayBounds(now = new Date()): { from: string; to: string } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function isOnBoard(order: OrderCard, now: Date): boolean {
  if (OPEN.has(order.status)) {
    return true;
  }
  if (!FINISHED.has(order.status)) {
    return false;
  }
  const created = new Date(order.createdAt);
  if (Number.isNaN(created.getTime())) {
    return false;
  }
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return created.getTime() >= start.getTime() && created.getTime() <= end.getTime();
}

export function firstName(name: string): string {
  const [first] = name.trim().split(/\s+/);
  return first ?? '';
}

export function ageLabel(createdAt: string, nowMs: number): string {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) {
    return '';
  }
  const minutes = Math.max(0, Math.floor((nowMs - created) / 60000));
  if (minutes < 1) {
    return 'há menos de 1 minuto';
  }
  if (minutes === 1) {
    return 'há 1 minuto';
  }
  return `há ${minutes} minutos`;
}

export function applyOrderEvent(
  orders: readonly OrderCard[],
  event: OrderRealtimeEvent,
  fetched: OrderCard | null,
  now: Date,
): { orders: OrderCard[]; highlight: boolean } {
  const current = orders.find((order) => order.id === event.orderId) ?? fetched;
  if (current === null) {
    return { orders: sortOrders(orders), highlight: false };
  }
  const next: OrderCard = {
    ...current,
    status: event.status,
    orderNumber: event.orderNumber,
  };
  const rest = orders.filter((order) => order.id !== event.orderId);
  if (!isOnBoard(next, now)) {
    return { orders: sortOrders(rest), highlight: false };
  }
  return {
    orders: sortOrders([next, ...rest]),
    highlight: event.event === 'order.created',
  };
}

export function placeCard(
  orders: readonly OrderCard[],
  card: OrderCard,
  now: Date,
): OrderCard[] {
  const rest = orders.filter((order) => order.id !== card.id);
  if (!isOnBoard(card, now)) {
    return sortOrders(rest);
  }
  return sortOrders([card, ...rest]);
}

export function mergeBoard(
  server: readonly OrderCard[],
  local: readonly OrderCard[],
  pendingIds: ReadonlySet<string>,
  now: Date,
): OrderCard[] {
  const localById = new Map(local.map((order) => [order.id, order]));
  const merged = new Map<string, OrderCard>();
  for (const order of server) {
    const pending = pendingIds.has(order.id) ? localById.get(order.id) : undefined;
    merged.set(order.id, pending ?? order);
  }
  for (const id of pendingIds) {
    const live = localById.get(id);
    if (live !== undefined && !merged.has(id)) {
      merged.set(id, live);
    }
  }
  return sortOrders([...merged.values()].filter((order) => isOnBoard(order, now)));
}

function sortOrders(orders: readonly OrderCard[]): OrderCard[] {
  return [...orders].sort((left, right) => {
    const byTime = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    if (byTime !== 0) {
      return byTime;
    }
    return right.orderNumber - left.orderNumber;
  });
}
