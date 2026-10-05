import { AuditLogs, actorTypeOf, recordAudit } from '@ciadelivery/audit';
import { DomainException } from '@ciadelivery/shared';
import { CurrentStore } from '@ciadelivery/stores';
import { UnitOfWork } from '@ciadelivery/tenancy/domain';
import { RequestActor } from '@ciadelivery/users';
import {
  ANONYMIZED_CUSTOMER_NAME,
  anonymizedPhone,
  assertPhoneConfirmation,
} from '../domain/anonymize';
import {
  CustomerConsentRecord,
  CustomerDetailView,
  toAddressView,
  toCustomerView,
} from '../domain/customer';
import { CustomerOrders, ExportedOrder } from '../domain/customer-orders';
import { CustomerRepository } from '../domain/customer-repository';
import { requireActorStore, scopeOf } from './actor-store';

export interface CustomerExport {
  customer: CustomerDetailView;
  consents: CustomerConsentRecord[];
  orders: ExportedOrder[];
}

export class CustomerPrivacy {
  constructor(
    private readonly customers: CustomerRepository,
    private readonly orders: CustomerOrders,
    private readonly stores: CurrentStore,
    private readonly unitOfWork: UnitOfWork,
    private readonly audit: AuditLogs,
    private readonly salt: string,
  ) {}

  async export(actor: RequestActor, customerId: string): Promise<CustomerExport> {
    const store = await requireActorStore(actor, this.stores);
    const scope = scopeOf(store);
    const customer = await this.customers.findById(scope, customerId);
    if (customer === null) {
      throw new DomainException(
        'CUSTOMER_NOT_FOUND',
        'The customer was not found',
        404,
      );
    }
    const [addresses, consents, orders] = await Promise.all([
      this.customers.listAddresses(scope, customer.id),
      this.customers.listConsents(scope, customer.id),
      this.orders.list(scope, customer.id),
    ]);
    return {
      customer: {
        ...toCustomerView(customer),
        addresses: addresses.map(toAddressView),
      },
      consents,
      orders,
    };
  }

  async anonymize(
    actor: RequestActor,
    customerId: string,
    typedPhone: string,
  ): Promise<CustomerDetailView> {
    const store = await requireActorStore(actor, this.stores);
    const scope = scopeOf(store);
    const existing = await this.customers.findById(scope, customerId);
    if (existing === null) {
      throw new DomainException(
        'CUSTOMER_NOT_FOUND',
        'The customer was not found',
        404,
      );
    }
    assertPhoneConfirmation(existing.phone, typedPhone);
    const phone = anonymizedPhone(existing.phone, this.salt);
    const updatedAt = new Date();

    await this.unitOfWork.run(async (tx) => {
      const locked = await this.customers.lockById(scope, customerId, tx);
      if (locked === null) {
        throw new DomainException(
          'CUSTOMER_NOT_FOUND',
          'The customer was not found',
          404,
        );
      }
      assertPhoneConfirmation(locked.phone, typedPhone);
      await this.customers.applyAnonymized(
        {
          ...locked,
          name: ANONYMIZED_CUSTOMER_NAME,
          phone,
          updatedAt,
        },
        tx,
      );
      await this.customers.reduceAddressesToCity(scope, locked.id, tx);
      await this.orders.anonymize(
        scope,
        locked.id,
        ANONYMIZED_CUSTOMER_NAME,
        phone,
        tx,
      );
      await recordAudit(this.audit, tx, {
        tenantId: scope.tenantId,
        actorId: actor.userId,
        actorType: actorTypeOf(actor.role),
        action: 'customer.anonymized',
        entityType: 'customer',
        entityId: locked.id,
        before: { name: locked.name },
        changes: { name: ANONYMIZED_CUSTOMER_NAME },
      });
    });

    const addresses = await this.customers.listAddresses(scope, customerId);
    return {
      ...toCustomerView({
        ...existing,
        name: ANONYMIZED_CUSTOMER_NAME,
        phone,
        updatedAt,
      }),
      addresses: addresses.map(toAddressView),
    };
  }
}
