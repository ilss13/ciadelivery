const STATUS_LABELS: Record<string, string> = {
  NEW: 'Pedido realizado',
  ACCEPTED: 'Aceito',
  IN_PREPARATION: 'Em preparação',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Pedido entregue',
  REJECTED: 'Recusado',
  CANCELLED: 'Cancelado',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function fulfillmentLabel(fulfillment: string): string {
  if (fulfillment === 'DELIVERY') {
    return 'Entrega';
  }
  if (fulfillment === 'PICKUP') {
    return 'Retirada';
  }
  return fulfillment;
}

export function formatWhen(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}
