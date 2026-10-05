import { readErrorCode } from '../../core/api-error';

const STORE_TIME_ZONE = 'America/Sao_Paulo';

const MESSAGES: Record<string, string> = {
  FORBIDDEN: 'Você não consulta os relatórios desta loja.',
  REPORT_PERIOD_INVALID: 'O período precisa ter até 366 dias.',
  VALIDATION_ERROR: 'Informe as duas datas do período.',
};

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Novo',
  ACCEPTED: 'Aceito',
  IN_PREPARATION: 'Em preparo',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  REJECTED: 'Recusado',
  CANCELLED: 'Cancelado',
};

const SOURCE_LABELS: Record<string, string> = {
  STOREFRONT: 'Loja',
  WHATSAPP: 'WhatsApp',
};

export function reportsErrorMessage(error: unknown): string {
  const code = readErrorCode(error);
  return MESSAGES[code] ?? 'Não foi possível carregar os relatórios.';
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

export function storeToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function shiftStoreDate(isoDate: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (match === null) {
    return isoDate;
  }
  const shifted = new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]) + days,
    ),
  );
  return shifted.toISOString().slice(0, 10);
}

export function periodPreset(
  kind: 'today' | '7' | '30',
  now = new Date(),
): { from: string; to: string } {
  const to = storeToday(now);
  if (kind === 'today') {
    return { from: to, to };
  }
  return { from: shiftStoreDate(to, kind === '7' ? -6 : -29), to };
}
