export const REALTIME_CHANNEL = 'realtime';

export const ORDER_REALTIME_TYPES = [
  'order.created',
  'order.updated',
  'order.accepted',
  'order.rejected',
  'order.in_preparation',
  'order.ready',
  'order.delivered',
  'order.cancelled',
] as const;

export type OrderRealtimeType = (typeof ORDER_REALTIME_TYPES)[number];

export interface OrderRealtimePayload {
  orderId: string;
  status: string;
  orderNumber: number;
  occurredAt: string;
}

export interface OrderRealtimeDispatch {
  event: OrderRealtimeType;
  storeId: string;
  rooms: string[];
  payload: OrderRealtimePayload;
}

export interface RealtimeEnvelope {
  event: string;
  rooms: string[];
  payload: Record<string, string | number>;
}

export interface StaffRoomClaims {
  role: string;
  tenantId: string | null;
  storeId: string | null;
  permissions: readonly string[];
}

export type RealtimeCredentials =
  | { kind: 'staff'; token: string }
  | { kind: 'customer'; trackingToken: string };

const ROOM_PREFIX = /^(tenant|store|order):/;

export function isOrderRealtimeType(type: string): type is OrderRealtimeType {
  return (ORDER_REALTIME_TYPES as readonly string[]).includes(type);
}

export function roomsForStaff(claims: StaffRoomClaims): string[] {
  if (!claims.permissions.includes('orders.read')) {
    return [];
  }

  const rooms: string[] = [];
  if (claims.tenantId !== null && claims.tenantId.length > 0) {
    rooms.push(`tenant:${claims.tenantId}`);
  }
  if (
    claims.role !== 'COURIER' &&
    claims.storeId !== null &&
    claims.storeId.length > 0
  ) {
    rooms.push(`store:${claims.storeId}`);
  }
  return rooms;
}

export function decideRoomJoin(
  allowed: readonly string[],
  room: string,
): 'join' | 'ignore' {
  if (!ROOM_PREFIX.test(room) || !allowed.includes(room)) {
    return 'ignore';
  }
  return 'join';
}

export function orderRealtimeDispatch(input: {
  type: string;
  payload: Record<string, unknown>;
}): OrderRealtimeDispatch | null {
  if (!isOrderRealtimeType(input.type)) {
    return null;
  }

  const orderId = readText(input.payload['orderId']);
  const storeId = readText(input.payload['storeId']);
  const status = readText(input.payload['status']);
  const occurredAt = readInstant(input.payload['occurredAt']);
  const orderNumber = readOrderNumber(input.payload['orderNumber']);
  if (
    orderId === null ||
    storeId === null ||
    status === null ||
    occurredAt === null ||
    orderNumber === null
  ) {
    return null;
  }

  const rooms =
    input.type === 'order.created'
      ? [`store:${storeId}`]
      : [`store:${storeId}`, `order:${orderId}`];

  return {
    event: input.type,
    storeId,
    rooms,
    payload: {
      orderId,
      status,
      orderNumber,
      occurredAt,
    },
  };
}

export function readRealtimeCredentials(input: {
  queryToken: unknown;
  authToken: unknown;
  trackingToken: unknown;
}): RealtimeCredentials | null {
  const token = readCredential(input.authToken) ?? readCredential(input.queryToken);
  if (token !== null) {
    return { kind: 'staff', token };
  }

  const trackingToken = readCredential(input.trackingToken);
  if (trackingToken !== null) {
    return { kind: 'customer', trackingToken };
  }
  return null;
}

export function parseRealtimeEnvelope(raw: string): RealtimeEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const event = readText(record['event']);
  const rooms = readRooms(record['rooms']);
  const payload = readPayload(record['payload']);
  if (event === null || rooms === null || payload === null) {
    return null;
  }
  return { event, rooms, payload };
}

export function newOrderNotificationCopy(orderNumber: number): {
  title: string;
  body: string;
} {
  const title = `Novo pedido #${orderNumber}`;
  return { title, body: title };
}

function readCredential(value: unknown): string | null {
  if (Array.isArray(value)) {
    return readText(value[0]);
  }
  return readText(value);
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function readOrderNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  return null;
}

function readInstant(value: unknown): string | null {
  const text = readText(value);
  if (text === null || Number.isNaN(new Date(text).getTime())) {
    return null;
  }
  return new Date(text).toISOString();
}

function readRooms(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const rooms: string[] = [];
  for (const room of value) {
    const text = readText(room);
    if (text === null || !ROOM_PREFIX.test(text)) {
      return null;
    }
    rooms.push(text);
  }
  return rooms;
}

function readPayload(value: unknown): Record<string, string | number> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const payload: Record<string, string | number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || typeof entry === 'number') {
      payload[key] = entry;
      continue;
    }
    return null;
  }
  return payload;
}
