import { readErrorCode } from '../../core/api-error';

const MESSAGES: Record<string, string> = {
  FORBIDDEN: 'Só o responsável da loja consulta a auditoria.',
  VALIDATION_ERROR: 'Revise os filtros e tente de novo.',
};

export function auditErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  return MESSAGES[code] ?? 'Não foi possível carregar a auditoria.';
}

const ACTION_LABELS: Record<string, string> = {
  'auth.login_succeeded': 'Login aceito',
  'auth.login_failed': 'Login recusado',
  'product.updated': 'Produto alterado',
  'order.cancelled': 'Pedido cancelado',
  'order.accepted': 'Pedido aceito',
  'order.rejected': 'Pedido recusado',
  'order.in_preparation': 'Pedido em preparo',
  'order.ready': 'Pedido pronto',
  'order.delivered': 'Pedido entregue',
  'order.out_for_delivery': 'Pedido saiu para entrega',
  'order.courier_assigned': 'Entregador atribuído',
  'branding.updated': 'Marca alterada',
  'business_hours.updated': 'Horários alterados',
  'delivery.updated': 'Entrega alterada',
  'delivery.zones_updated': 'Zonas de entrega alteradas',
  'delivery.zone_added': 'Zona de entrega criada',
  'delivery.zone_updated': 'Zona de entrega alterada',
  'delivery.zone_deleted': 'Zona de entrega removida',
  'payment_methods.updated': 'Pagamento alterado',
  'user.created': 'Usuário criado',
  'user.updated': 'Usuário alterado',
  'whatsapp.connected': 'WhatsApp conectado',
  'whatsapp.disconnected': 'WhatsApp desconectado',
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function formatAuditDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatChanges(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return JSON.stringify(value, null, 2);
}
