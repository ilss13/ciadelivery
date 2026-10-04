import { DomainException } from '@ciadelivery/shared';
import { currentTenant } from '@ciadelivery/tenancy/domain';
import { CurrentStore, StoreAddress } from '@ciadelivery/stores';
import { BrandingView, defaultBranding } from '../domain/branding';
import { BrandingRepository } from '../domain/branding-repository';
import { BusinessDay, completeWeek } from '../domain/business-hours';
import { BusinessHoursRepository } from '../domain/business-hours-repository';
import { isStoreOpen } from '../domain/is-open';

export interface PublicStoreProfile {
  id: string;
  name: string;
  phone: string;
  address: StoreAddress;
  minimumOrderCents: number;
  isManuallyClosed: boolean;
  slug: string;
  branding: BrandingView;
  hours: BusinessDay[];
  isOpen: boolean;
}

export class GetPublicStore {
  constructor(
    private readonly stores: CurrentStore,
    private readonly branding: BrandingRepository,
    private readonly hours: BusinessHoursRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(): Promise<PublicStoreProfile> {
    const tenant = currentTenant();
    if (tenant === null) {
      throw new DomainException(
        'TENANT_NOT_FOUND',
        'The tenant was not found',
        404,
      );
    }

    const store = await this.stores.findForCurrentTenant();
    if (store === null || store.tenantId !== tenant.id) {
      throw new DomainException(
        'STORE_NOT_FOUND',
        'The store was not found',
        404,
      );
    }

    const branding =
      (await this.branding.findCurrent()) ?? defaultBranding(store.name);
    const hours = completeWeek(await this.hours.listCurrent());
    return {
      id: store.id,
      name: store.name,
      phone: store.phone,
      address: store.address,
      minimumOrderCents: store.minimumOrderCents,
      isManuallyClosed: store.isManuallyClosed,
      slug: tenant.slug,
      branding,
      hours,
      isOpen: isStoreOpen({
        now: this.now(),
        timeZone: store.timezone,
        manuallyClosed: store.isManuallyClosed,
        hours,
      }),
    };
  }
}
