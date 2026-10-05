export const ORDER_SOURCES = ['STOREFRONT', 'WHATSAPP'] as const;

export type OrderSource = (typeof ORDER_SOURCES)[number];

export const REPORT_STATUSES = [
  'NEW',
  'ACCEPTED',
  'IN_PREPARATION',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'CANCELLED',
] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

export interface ReportWindow {
  tenantId: string;
  start: Date;
  end: Date;
}

export interface StatusCount {
  status: ReportStatus;
  count: number;
}

export interface SourceCount {
  source: OrderSource;
  count: number;
}

export interface ReportOverview {
  orderCount: number;
  revenueCents: number;
  averageTicketCents: number;
  cancelledCount: number;
  byStatus: StatusCount[];
  bySource: SourceCount[];
}

export interface ProductReportRow {
  productId: string | null;
  productName: string;
  quantity: number;
  subtotalCents: number;
}

export interface CustomerReportRow {
  customerId: string;
  name: string;
  phone: string;
  orderCount: number;
}

export interface MaskedCustomerReportRow {
  customerId: string;
  name: string;
  maskedPhone: string;
  orderCount: number;
}

export interface CourierReportRow {
  courierId: string;
  name: string;
  deliveredCount: number;
}

export interface CsvOrderRow {
  orderNumber: number;
  createdAt: Date;
  status: ReportStatus;
  totalCents: number;
  source: OrderSource;
  fulfillment: 'DELIVERY' | 'PICKUP';
}

export interface DashboardHour {
  weekday: number;
  opensAt: string;
  closesAt: string;
  closed: boolean;
}

export interface DashboardFacts {
  newCount: number;
  inPreparationCount: number;
  readyCount: number;
  outForDeliveryCount: number;
  deliveredTodayCount: number;
  revenueCents: number;
  hours: DashboardHour[];
  whatsappConnected: boolean;
}

export interface ReportsReader {
  overview(window: ReportWindow): Promise<ReportOverview>;
  products(window: ReportWindow): Promise<ProductReportRow[]>;
  customers(window: ReportWindow): Promise<CustomerReportRow[]>;
  couriers(window: ReportWindow): Promise<CourierReportRow[]>;
  orders(window: ReportWindow): Promise<CsvOrderRow[]>;
  dashboard(window: ReportWindow): Promise<DashboardFacts>;
}

export const REPORTS = Symbol('REPORTS');

export function averageTicketCents(
  revenueCents: number,
  billableCount: number,
): number {
  if (billableCount <= 0) {
    return 0;
  }
  return Math.trunc(revenueCents / billableCount);
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const visible = digits.slice(-4);
  return `${'*'.repeat(Math.max(digits.length - visible.length, 0))}${visible}`;
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  NEW: 'Novo',
  ACCEPTED: 'Aceito',
  IN_PREPARATION: 'Em preparo',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  DELIVERED: 'Entregue',
  REJECTED: 'Recusado',
  CANCELLED: 'Cancelado',
};

const SOURCE_LABELS: Record<OrderSource, string> = {
  STOREFRONT: 'Loja',
  WHATSAPP: 'WhatsApp',
};

export function ordersToCsv(
  rows: readonly CsvOrderRow[],
  timeZone: string,
): string {
  const lines = ['número;data;status;total;origem;tipo'];
  for (const row of rows) {
    lines.push(
      [
        String(row.orderNumber),
        formatReportDate(row.createdAt, timeZone),
        STATUS_LABELS[row.status],
        formatCents(row.totalCents),
        SOURCE_LABELS[row.source],
        row.fulfillment === 'DELIVERY' ? 'Entrega' : 'Retirada',
      ]
        .map(csvCell)
        .join(';'),
    );
  }
  return `\uFEFF${lines.join('\n')}\n`;
}

function formatReportDate(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${read('day')}/${read('month')}/${read('year')} ${read('hour')}:${read('minute')}`;
}

function formatCents(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  const reais = Math.trunc(abs / 100);
  const fraction = (abs % 100).toString().padStart(2, '0');
  return `${cents < 0 ? '-' : ''}${reais},${fraction}`;
}

function csvCell(value: string): string {
  if (/[;"\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
