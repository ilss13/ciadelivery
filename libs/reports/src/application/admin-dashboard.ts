import { isStoreOpen } from '@ciadelivery/branding';
import { DomainException } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { RequestActor } from '@ciadelivery/users';
import { resolveStorePeriod, todayInTimeZone } from '../domain/report-period';
import { ReportsReader } from '../domain/reports';

export interface DashboardSnapshot {
  newCount: number;
  inPreparationCount: number;
  readyCount: number;
  outForDeliveryCount: number;
  deliveredTodayCount: number;
  revenueCents: number;
  storeOpen: boolean;
  whatsappConnected: boolean;
}

export class AdminDashboard {
  constructor(
    private readonly reports: ReportsReader,
    private readonly stores: CurrentStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(actor: RequestActor): Promise<DashboardSnapshot> {
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

    const instant = this.now();
    const today = todayInTimeZone(instant, store.timezone);
    const period = resolveStorePeriod(today, today, store.timezone);
    const facts = await this.reports.dashboard({
      tenantId: actor.tenantId,
      start: period.start,
      end: period.end,
    });
    return {
      newCount: facts.newCount,
      inPreparationCount: facts.inPreparationCount,
      readyCount: facts.readyCount,
      outForDeliveryCount: facts.outForDeliveryCount,
      deliveredTodayCount: facts.deliveredTodayCount,
      revenueCents: facts.revenueCents,
      storeOpen: isStoreOpen({
        now: instant,
        timeZone: store.timezone,
        manuallyClosed: store.isManuallyClosed,
        hours: facts.hours,
      }),
      whatsappConnected: facts.whatsappConnected,
    };
  }
}
