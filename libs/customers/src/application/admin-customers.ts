import { DomainException } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { RequestActor } from '@ciadelivery/users';
import {
  CustomerDetailView,
  CustomerSearch,
  Page,
  CustomerView,
  toAddressView,
  toCustomerView,
  toPage,
} from '../domain/customer';
import { CustomerRepository } from '../domain/customer-repository';
import { normalizeBrazilPhone } from '../domain/phone';
import { requireActorStore, scopeOf } from './actor-store';

export class AdminCustomers {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly stores: CurrentStore,
  ) {}

  async list(
    actor: RequestActor,
    page: number,
    pageSize: number,
    raw: { phone?: string; name?: string },
  ): Promise<Page<CustomerView>> {
    const store = await requireActorStore(actor, this.stores);
    const search = this.search(raw);
    const listed = await this.customers.list(
      scopeOf(store),
      { page, pageSize },
      search,
    );
    return toPage(
      listed.data.map(toCustomerView),
      listed.meta.total,
      page,
      pageSize,
    );
  }

  async get(actor: RequestActor, id: string): Promise<CustomerDetailView> {
    const store = await requireActorStore(actor, this.stores);
    const scope = scopeOf(store);
    const customer = await this.customers.findById(scope, id);
    if (customer === null) {
      throw new DomainException(
        'CUSTOMER_NOT_FOUND',
        'The customer was not found',
        404,
      );
    }

    const addresses = await this.customers.listAddresses(scope, customer.id);
    return {
      ...toCustomerView(customer),
      addresses: addresses.map(toAddressView),
    };
  }

  private search(raw: { phone?: string; name?: string }): CustomerSearch {
    const search: CustomerSearch = {};
    if (raw.phone !== undefined && raw.phone.trim().length > 0) {
      search.phone = normalizeBrazilPhone(raw.phone);
    }
    if (raw.name !== undefined && raw.name.trim().length > 0) {
      search.name = raw.name.trim();
    }
    return search;
  }
}
