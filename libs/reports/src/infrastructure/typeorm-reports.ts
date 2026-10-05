import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CourierReportRow,
  CsvOrderRow,
  CustomerReportRow,
  DashboardFacts,
  DashboardHour,
  ORDER_SOURCES,
  OrderSource,
  ProductReportRow,
  REPORT_STATUSES,
  ReportOverview,
  ReportStatus,
  ReportWindow,
  ReportsReader,
  SourceCount,
  StatusCount,
  averageTicketCents,
} from '../domain/reports';

@Injectable()
export class TypeOrmReports implements ReportsReader {
  constructor(private readonly dataSource: DataSource) {}

  async overview(window: ReportWindow): Promise<ReportOverview> {
    const rows = await this.dataSource.query(
      `SELECT
         COUNT(*) AS orderCount,
         COALESCE(SUM(CASE WHEN status NOT IN ('CANCELLED', 'REJECTED') THEN total_cents ELSE 0 END), 0) AS revenueCents,
         COALESCE(SUM(CASE WHEN status NOT IN ('CANCELLED', 'REJECTED') THEN 1 ELSE 0 END), 0) AS billableCount,
         COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelledCount,
         COALESCE(SUM(CASE WHEN status = 'NEW' THEN 1 ELSE 0 END), 0) AS statusNew,
         COALESCE(SUM(CASE WHEN status = 'ACCEPTED' THEN 1 ELSE 0 END), 0) AS statusAccepted,
         COALESCE(SUM(CASE WHEN status = 'IN_PREPARATION' THEN 1 ELSE 0 END), 0) AS statusInPreparation,
         COALESCE(SUM(CASE WHEN status = 'READY' THEN 1 ELSE 0 END), 0) AS statusReady,
         COALESCE(SUM(CASE WHEN status = 'OUT_FOR_DELIVERY' THEN 1 ELSE 0 END), 0) AS statusOutForDelivery,
         COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END), 0) AS statusDelivered,
         COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END), 0) AS statusRejected,
         COALESCE(SUM(CASE WHEN source = 'STOREFRONT' THEN 1 ELSE 0 END), 0) AS sourceStorefront,
         COALESCE(SUM(CASE WHEN source = 'WHATSAPP' THEN 1 ELSE 0 END), 0) AS sourceWhatsapp
       FROM orders
       WHERE tenant_id = ? AND created_at >= ? AND created_at < ?`,
      [window.tenantId, window.start, window.end],
    );
    const record = firstRow(rows);
    const revenueCents = integerOf(record['revenueCents']);
    const billableCount = integerOf(record['billableCount']);
    const byStatus: StatusCount[] = [
      { status: 'NEW', count: integerOf(record['statusNew']) },
      { status: 'ACCEPTED', count: integerOf(record['statusAccepted']) },
      { status: 'IN_PREPARATION', count: integerOf(record['statusInPreparation']) },
      { status: 'READY', count: integerOf(record['statusReady']) },
      { status: 'OUT_FOR_DELIVERY', count: integerOf(record['statusOutForDelivery']) },
      { status: 'DELIVERED', count: integerOf(record['statusDelivered']) },
      { status: 'REJECTED', count: integerOf(record['statusRejected']) },
      { status: 'CANCELLED', count: integerOf(record['cancelledCount']) },
    ];
    const bySource: SourceCount[] = [
      { source: 'STOREFRONT', count: integerOf(record['sourceStorefront']) },
      { source: 'WHATSAPP', count: integerOf(record['sourceWhatsapp']) },
    ];
    return {
      orderCount: integerOf(record['orderCount']),
      revenueCents,
      averageTicketCents: averageTicketCents(revenueCents, billableCount),
      cancelledCount: integerOf(record['cancelledCount']),
      byStatus,
      bySource,
    };
  }

  async products(window: ReportWindow): Promise<ProductReportRow[]> {
    const rows: unknown = await this.dataSource.query(
      `SELECT
         oi.product_id AS productId,
         MAX(oi.product_name) AS productName,
         SUM(oi.quantity) AS quantity,
         SUM(oi.subtotal_cents) AS subtotalCents
       FROM order_items oi
       INNER JOIN orders o
         ON o.id = oi.order_id
        AND o.tenant_id = oi.tenant_id
       WHERE o.tenant_id = ?
         AND o.created_at >= ?
         AND o.created_at < ?
         AND o.status NOT IN ('CANCELLED', 'REJECTED')
       GROUP BY oi.product_id
       ORDER BY quantity DESC, subtotalCents DESC
       LIMIT 20`,
      [window.tenantId, window.start, window.end],
    );
    return asRows(rows).map((row) => ({
      productId: row['productId'] === null ? null : stringOf(row['productId']),
      productName: stringOf(row['productName']),
      quantity: integerOf(row['quantity']),
      subtotalCents: integerOf(row['subtotalCents']),
    }));
  }

  async customers(window: ReportWindow): Promise<CustomerReportRow[]> {
    const rows: unknown = await this.dataSource.query(
      `SELECT
         c.id AS customerId,
         c.name AS name,
         c.phone AS phone,
         COUNT(*) AS orderCount
       FROM orders o
       INNER JOIN customers c
         ON c.id = o.customer_id
        AND c.tenant_id = o.tenant_id
       WHERE o.tenant_id = ?
         AND o.created_at >= ?
         AND o.created_at < ?
       GROUP BY c.id, c.name, c.phone
       HAVING COUNT(*) >= 2
       ORDER BY orderCount DESC, c.name ASC`,
      [window.tenantId, window.start, window.end],
    );
    return asRows(rows).map((row) => ({
      customerId: stringOf(row['customerId']),
      name: stringOf(row['name']),
      phone: stringOf(row['phone']),
      orderCount: integerOf(row['orderCount']),
    }));
  }

  async couriers(window: ReportWindow): Promise<CourierReportRow[]> {
    const rows: unknown = await this.dataSource.query(
      `SELECT
         c.id AS courierId,
         c.name AS name,
         COUNT(*) AS deliveredCount
       FROM delivery_assignments a
       INNER JOIN couriers c
         ON c.id = a.courier_id
        AND c.tenant_id = a.tenant_id
       WHERE a.tenant_id = ?
         AND a.status = 'DELIVERED'
         AND a.delivered_at >= ?
         AND a.delivered_at < ?
       GROUP BY c.id, c.name
       ORDER BY deliveredCount DESC, c.name ASC`,
      [window.tenantId, window.start, window.end],
    );
    return asRows(rows).map((row) => ({
      courierId: stringOf(row['courierId']),
      name: stringOf(row['name']),
      deliveredCount: integerOf(row['deliveredCount']),
    }));
  }

  async orders(window: ReportWindow): Promise<CsvOrderRow[]> {
    const rows: unknown = await this.dataSource.query(
      `SELECT
         order_number AS orderNumber,
         created_at AS createdAt,
         status AS status,
         total_cents AS totalCents,
         source AS source,
         fulfillment AS fulfillment
       FROM orders
       WHERE tenant_id = ?
         AND created_at >= ?
         AND created_at < ?
       ORDER BY created_at ASC, order_number ASC`,
      [window.tenantId, window.start, window.end],
    );
    return asRows(rows).map((row) => ({
      orderNumber: integerOf(row['orderNumber']),
      createdAt: dateOf(row['createdAt']),
      status: statusOf(row['status']),
      totalCents: integerOf(row['totalCents']),
      source: sourceOf(row['source']),
      fulfillment: fulfillmentOf(row['fulfillment']),
    }));
  }

  async dashboard(window: ReportWindow): Promise<DashboardFacts> {
    const [pipelineRows, deliveredRows, hourRows, connectionRows] =
      await Promise.all([
        this.dataSource.query(
          `SELECT
             COALESCE(SUM(status = 'NEW'), 0) AS newCount,
             COALESCE(SUM(status = 'IN_PREPARATION'), 0) AS inPreparationCount,
             COALESCE(SUM(status = 'READY'), 0) AS readyCount,
             COALESCE(SUM(status = 'OUT_FOR_DELIVERY'), 0) AS outForDeliveryCount,
             COALESCE(SUM(CASE
               WHEN created_at >= ? AND created_at < ?
                 AND status NOT IN ('CANCELLED', 'REJECTED')
               THEN total_cents ELSE 0 END), 0) AS revenueCents
           FROM orders
           WHERE tenant_id = ?`,
          [window.start, window.end, window.tenantId],
        ),
        this.dataSource.query(
          `SELECT COUNT(DISTINCT order_id) AS deliveredTodayCount
           FROM order_status_history
           WHERE tenant_id = ?
             AND to_status = 'DELIVERED'
             AND created_at >= ?
             AND created_at < ?`,
          [window.tenantId, window.start, window.end],
        ),
        this.dataSource.query(
          `SELECT weekday, opens_at AS opensAt, closes_at AS closesAt, closed
           FROM business_hours
           WHERE tenant_id = ?
           ORDER BY weekday ASC`,
          [window.tenantId],
        ),
        this.dataSource.query(
          `SELECT COUNT(*) AS connected
           FROM whatsapp_connections
           WHERE tenant_id = ? AND status = 'CONNECTED'`,
          [window.tenantId],
        ),
      ]);
    const pipeline = firstRow(pipelineRows);
    const delivered = firstRow(deliveredRows);
    const connection = firstRow(connectionRows);
    return {
      newCount: integerOf(pipeline['newCount']),
      inPreparationCount: integerOf(pipeline['inPreparationCount']),
      readyCount: integerOf(pipeline['readyCount']),
      outForDeliveryCount: integerOf(pipeline['outForDeliveryCount']),
      deliveredTodayCount: integerOf(delivered['deliveredTodayCount']),
      revenueCents: integerOf(pipeline['revenueCents']),
      hours: asRows(hourRows).map(toHour),
      whatsappConnected: integerOf(connection['connected']) > 0,
    };
  }
}

function toHour(row: Record<string, unknown>): DashboardHour {
  return {
    weekday: integerOf(row['weekday']),
    opensAt: clockOf(row['opensAt']),
    closesAt: clockOf(row['closesAt']),
    closed: row['closed'] === true || Number(row['closed']) === 1,
  };
}

function clockOf(value: unknown): string {
  if (typeof value === 'string') {
    const match = /^(\d{2}:\d{2}:\d{2})/.exec(value);
    if (match?.[1] !== undefined) {
      return match[1];
    }
  }
  if (value instanceof Date) {
    const hours = value.getUTCHours().toString().padStart(2, '0');
    const minutes = value.getUTCMinutes().toString().padStart(2, '0');
    const seconds = value.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
  throw new Error('The dashboard hour is invalid');
}

function firstRow(value: unknown): Record<string, unknown> {
  const rows = asRows(value);
  const row = rows[0];
  if (row === undefined) {
    throw new Error('The report aggregate is missing');
  }
  return row;
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error('The report query did not return rows');
  }
  return value.map((row) => {
    if (typeof row !== 'object' || row === null) {
      throw new Error('The report row is invalid');
    }
    return row as Record<string, unknown>;
  });
}

function integerOf(value: unknown): number {
  const numeric = typeof value === 'bigint' ? Number(value) : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error('The report aggregate is invalid');
  }
  return Math.trunc(numeric);
}

function stringOf(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('The report field is invalid');
  }
  return value;
}

function dateOf(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  throw new Error('The report date is invalid');
}

function statusOf(value: unknown): ReportStatus {
  if (typeof value === 'string' && isStatus(value)) {
    return value;
  }
  throw new Error('The report status is invalid');
}

function sourceOf(value: unknown): OrderSource {
  if (typeof value === 'string' && isSource(value)) {
    return value;
  }
  throw new Error('The report source is invalid');
}

function fulfillmentOf(value: unknown): 'DELIVERY' | 'PICKUP' {
  if (value === 'DELIVERY' || value === 'PICKUP') {
    return value;
  }
  throw new Error('The report fulfillment is invalid');
}

function isStatus(value: string): value is ReportStatus {
  return (REPORT_STATUSES as readonly string[]).includes(value);
}

function isSource(value: string): value is OrderSource {
  return (ORDER_SOURCES as readonly string[]).includes(value);
}
