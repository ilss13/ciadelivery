import { DomainException } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { RequestActor } from '@ciadelivery/users';
import { resolveStorePeriod } from '../domain/report-period';
import {
  CourierReportRow,
  CsvOrderRow,
  MaskedCustomerReportRow,
  ProductReportRow,
  ReportOverview,
  ReportsReader,
  maskPhone,
  ordersToCsv,
} from '../domain/reports';

export interface ReportPeriodInput {
  from: string;
  to: string;
}

export class AdminReports {
  constructor(
    private readonly reports: ReportsReader,
    private readonly stores: CurrentStore,
  ) {}

  overview(
    actor: RequestActor,
    query: ReportPeriodInput,
  ): Promise<ReportOverview> {
    return this.read(actor, query, (window) => this.reports.overview(window));
  }

  products(
    actor: RequestActor,
    query: ReportPeriodInput,
  ): Promise<ProductReportRow[]> {
    return this.read(actor, query, (window) => this.reports.products(window));
  }

  async customers(
    actor: RequestActor,
    query: ReportPeriodInput,
  ): Promise<MaskedCustomerReportRow[]> {
    const rows = await this.read(actor, query, (window) =>
      this.reports.customers(window),
    );
    return rows.map((row) => ({
      customerId: row.customerId,
      name: row.name,
      maskedPhone: maskPhone(row.phone),
      orderCount: row.orderCount,
    }));
  }

  couriers(
    actor: RequestActor,
    query: ReportPeriodInput,
  ): Promise<CourierReportRow[]> {
    return this.read(actor, query, (window) => this.reports.couriers(window));
  }

  async exportOrders(
    actor: RequestActor,
    query: ReportPeriodInput,
  ): Promise<string> {
    const window = await this.window(actor, query);
    const rows: CsvOrderRow[] = await this.reports.orders(window);
    return ordersToCsv(rows, window.timeZone);
  }

  private async read<T>(
    actor: RequestActor,
    query: ReportPeriodInput,
    load: (window: ReportQueryWindow) => Promise<T>,
  ): Promise<T> {
    return load(await this.window(actor, query));
  }

  private async window(
    actor: RequestActor,
    query: ReportPeriodInput,
  ): Promise<ReportQueryWindow> {
    if (actor.tenantId === null) {
      throw new DomainException('FORBIDDEN', 'The permission is required', 403);
    }

    const store = await this.stores.findForCurrentTenant();
    if (store === null || store.tenantId !== actor.tenantId) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    const period = resolveStorePeriod(query.from, query.to, store.timezone);
    return {
      tenantId: actor.tenantId,
      start: period.start,
      end: period.end,
      timeZone: store.timezone,
    };
  }
}

interface ReportQueryWindow {
  tenantId: string;
  start: Date;
  end: Date;
  timeZone: string;
}
