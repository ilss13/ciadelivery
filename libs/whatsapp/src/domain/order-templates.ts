export const ORDER_TEMPLATE_KEYS = [
  'order_received',
  'order_accepted',
  'order_rejected',
  'order_preparing',
  'order_ready',
  'order_out_for_delivery',
  'order_delivered',
  'order_cancelled',
] as const;

export type OrderTemplateKey = (typeof ORDER_TEMPLATE_KEYS)[number];

const EVENT_TEMPLATES = {
  'order.created': 'order_received',
  'order.accepted': 'order_accepted',
  'order.rejected': 'order_rejected',
  'order.in_preparation': 'order_preparing',
  'order.ready': 'order_ready',
  'order.out_for_delivery': 'order_out_for_delivery',
  'order.delivered': 'order_delivered',
  'order.cancelled': 'order_cancelled',
} as const;

export type OrderStatusEventType = keyof typeof EVENT_TEMPLATES;

const STATUS_LABELS: Record<string, string> = {
  NEW: 'recebido',
  ACCEPTED: 'aceito',
  REJECTED: 'recusado',
  IN_PREPARATION: 'em preparo',
  READY: 'pronto',
  OUT_FOR_DELIVERY: 'saiu para entrega',
  DELIVERED: 'entregue',
  CANCELLED: 'cancelado',
};

export function isOrderTemplateKey(value: string): value is OrderTemplateKey {
  return (ORDER_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function templateKeyForEvent(type: string): OrderTemplateKey | undefined {
  if (Object.prototype.hasOwnProperty.call(EVENT_TEMPLATES, type)) {
    return EVENT_TEMPLATES[type as OrderStatusEventType];
  }
  return undefined;
}

export function formatOrderTotal(totalCents: number): string {
  const cents = Math.trunc(totalCents);
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const whole = Math.trunc(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, '0');
  const grouped = whole.toLocaleString('pt-BR');
  return `${sign}R$ ${grouped},${fraction}`;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export interface OrderMessageInput {
  templateKey: OrderTemplateKey;
  customerName: string;
  orderNumber: number;
  storeName: string;
  totalCents: number;
  status: string;
}

export function orderStatusMessage(input: OrderMessageInput): string {
  const variables = {
    customerName: input.customerName.trim(),
    orderNumber: input.orderNumber,
    storeName: input.storeName.trim(),
    total: formatOrderTotal(input.totalCents),
    status: statusLabel(input.status),
  };
  return `${variables.customerName}, ${sentence(input.templateKey, variables)} Total ${variables.total}. Status: ${variables.status}. Acompanhe pelo link da loja.`;
}

export function confirmedOrderMessage(input: {
  customerName: string;
  orderNumber: number;
  trackingPath: string;
}): string {
  return `${input.customerName.trim()}, seu pedido ${input.orderNumber} foi criado. Acompanhe em ${input.trackingPath}`;
}

function sentence(
  templateKey: OrderTemplateKey,
  variables: { orderNumber: number; storeName: string },
): string {
  const order = `pedido ${variables.orderNumber}`;
  const store = variables.storeName;
  switch (templateKey) {
    case 'order_received':
      return `recebemos seu ${order} na ${store}.`;
    case 'order_accepted':
      return `aceitamos seu ${order} na ${store}.`;
    case 'order_rejected':
      return `não pudemos aceitar seu ${order} na ${store}.`;
    case 'order_preparing':
      return `seu ${order} na ${store} está em preparo.`;
    case 'order_ready':
      return `seu ${order} na ${store} está pronto.`;
    case 'order_out_for_delivery':
      return `seu ${order} na ${store} saiu para entrega.`;
    case 'order_delivered':
      return `seu ${order} na ${store} foi entregue.`;
    case 'order_cancelled':
      return `seu ${order} na ${store} foi cancelado.`;
  }
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const visible = digits.slice(-4);
  return `${'*'.repeat(Math.max(digits.length - visible.length, 0))}${visible}`;
}

export function whatsAppRecipient(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}
